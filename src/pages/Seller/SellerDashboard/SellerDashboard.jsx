import React, { useEffect, useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import addressService from '../../../services/addressService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default function SellerDashboard() {
  const { user, activeTab, setActiveTab } = useOutletContext();
  const { showToast } = useToast();
  
  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Create / Edit Product Form States
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    condition: 'Đã qua sử dụng',
    price: '',
    stockQuantity: '1',
    weightGram: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    isForAuction: false,
  });
  
  // Image list state (array of { id (local index), imageId, imageUrl, altText, isMain })
  const [images, setImages] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  
  // Dynamic attribute values (dictionary of attributeId -> value)
  const [dynamicAttributes, setDynamicAttributes] = useState({});
  // Validation errors (dictionary of field/attribute ID -> error message)
  const [validationErrors, setValidationErrors] = useState({});
  const [isAddressPopupOpen, setIsAddressPopupOpen] = useState(false);

  // Validate single dynamic attribute
  const validateAttribute = (attr, val) => {
    const isProvided = val !== undefined && val !== null && String(val).trim() !== '';

    if (attr.isRequired && !isProvided) {
      return `"${attr.name}" is required.`;
    }

    if (isProvided) {
      if (attr.dataType === 'Number') {
        const numVal = Number(val);
        if (isNaN(numVal)) {
          return `"${attr.name}" must be a valid number.`;
        }
        if (attr.minValue !== undefined && attr.minValue !== null && numVal < attr.minValue) {
          return `"${attr.name}" must be greater than or equal to ${attr.minValue}.`;
        }
        if (attr.maxValue !== undefined && attr.maxValue !== null && numVal > attr.maxValue) {
          return `"${attr.name}" must be less than or equal to ${attr.maxValue}.`;
        }
      }
    }
    return '';
  };

  // Validate standard fields
  const validateStandardField = (name, value, isAuction = formData.isForAuction) => {
    switch (name) {
      case 'name':
        if (!value || String(value).trim() === '') {
          return 'Product name cannot be empty.';
        }
        break;
      case 'price':
        if (!isAuction) {
          const numPrice = parseFloat(value);
          if (isNaN(numPrice) || numPrice <= 0) {
            return 'Price must be greater than 0.';
          }
        }
        break;
      case 'stockQuantity':
        if (!isAuction) {
          const numStock = parseInt(value, 10);
          if (isNaN(numStock) || numStock < 1) {
            return 'Stock quantity must be at least 1.';
          }
        }
        break;
      case 'weightGram':
        if (value) {
          const numVal = parseInt(value, 10);
          if (isNaN(numVal) || numVal <= 0) {
            return 'Weight must be greater than 0.';
          }
        }
        break;
      case 'lengthCm':
      case 'widthCm':
      case 'heightCm':
        if (value) {
          const numVal = parseInt(value, 10);
          if (isNaN(numVal) || numVal <= 0) {
            return 'Dimension must be greater than 0.';
          }
        }
        break;
      default:
        return '';
    }
    return '';
  };

  useEffect(() => {
    if (user) {
      fetchMyProducts();
      fetchCategories();
    }
  }, [user]);

  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatus, setSellerStatus] = useState('');
  const [sellerSort, setSellerSort] = useState('newest');

  const fetchMyProducts = async () => {
    if (!user?.userId) return;
    try {
      setProductsLoading(true);
      const params = { 
        sellerId: user.userId,
        SortBy: sellerSort,
        PageSize: 50 // Retrieve up to 50 for dashboard simplicity
      };
      if (sellerSearch.trim()) params.SearchTerm = sellerSearch.trim();
      if (sellerStatus) params.Status = sellerStatus;

      const res = await productService.getAll(params);
      setMyProducts(res?.items || []);
    } catch (e) {
      showToast('Failed to load your product list.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'products') {
      fetchMyProducts();
    }
  }, [activeTab, user, sellerStatus, sellerSort]); // Search is handled by explicit button or can be added to deps

  const handleSellerSearchSubmit = (e) => {
    e.preventDefault();
    fetchMyProducts();
  };

  const fetchCategories = async () => {
    try {
      const res = await categoryService.getAll();
      setCategories(Array.isArray(res) ? res : (res?.value || []));
    } catch (e) {
      showToast('Failed to load categories.', 'error');
    }
  };

  // Find currently selected category attributes template
  const currentCategoryAttributes = useMemo(() => {
    if (!formData.categoryId) return [];
    const cat = categories.find((c) => c.categoryId === formData.categoryId);
    return cat?.attributes || [];
  }, [formData.categoryId, categories]);

  // Handle inputs change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    if (name === 'categoryId') {
      setDynamicAttributes({});
      setValidationErrors({});
    } else {
      const errorMsg = validateStandardField(name, finalValue);
      setValidationErrors((prev) => ({
        ...prev,
        [name]: errorMsg,
      }));
    }
  };

  // Switch type seller listing
  const handleAuctionToggle = (e) => {
    const checked = e.target.checked;
    setFormData((prev) => ({
      ...prev,
      isForAuction: checked,
      stockQuantity: checked ? '1' : prev.stockQuantity,
      price: checked ? '' : prev.price,
    }));

    setValidationErrors((prev) => {
      const updated = { ...prev };
      if (checked) {
        delete updated.price;
        delete updated.stockQuantity;
      } else {
        updated.price = validateStandardField('price', formData.price, false);
        updated.stockQuantity = validateStandardField('stockQuantity', formData.stockQuantity, false);
      }
      return updated;
    });
  };

  // Handle Dynamic Attributes change
  const handleAttrChange = (attributeId, value) => {
    setDynamicAttributes((prev) => ({
      ...prev,
      [attributeId]: value,
    }));

    const attrTemplate = currentCategoryAttributes.find((a) => a.attributeId === attributeId);
    if (attrTemplate) {
      const errorMsg = validateAttribute(attrTemplate, value);
      setValidationErrors((prev) => ({
        ...prev,
        [attributeId]: errorMsg,
      }));
    }
  };

  // Upload Product Image to Cloudinary
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setProductsLoading(true);
      const file = files[0];
      const res = await productService.uploadImage(file);
      if (res && res.imageUrl) {
        const newImage = {
          id: Date.now().toString(),
          imageUrl: res.imageUrl,
          altText: formData.name || 'Product Image',
          isMain: images.length === 0,
        };
        setImages((prev) => [...prev, newImage]);
        showToast('Image uploaded successfully.', 'success');
      }
    } catch (err) {
      showToast('Failed to upload image.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  // Remove Image
  const handleRemoveImage = (imgId) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.id !== imgId && i.imageId !== imgId);
      // Re-assign main image if the removed one was main
      const wasMain = prev.find((i) => i.id === imgId || i.imageId === imgId)?.isMain;
      if (wasMain && filtered.length > 0) {
        filtered[0].isMain = true;
      }
      return filtered;
    });
  };

  // Set Main Image
  const handleSetMainImage = (imgId) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isMain: img.id === imgId || img.imageId === imgId,
      }))
    );
  };

  const openNewProductFormDirectly = () => {
    setFormData({
      name: '',
      categoryId: '',
      description: '',
      condition: 'Used',
      price: '',
      stockQuantity: '1',
      weightGram: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      isForAuction: false,
    });
    setImages([]);
    setDynamicAttributes({});
    setValidationErrors({});
    setSelectedProductId(null);
    setActiveTab('new-product');
  };

  // Setup form for New Product
  const initNewProductForm = async () => {
    try {
      setProductsLoading(true);
      const data = await addressService.getMyAddresses();
      const addrList = Array.isArray(data) ? data : (data?.data || []);
      if (addrList.length === 0) {
        showToast('Bạn cần thêm địa chỉ trước khi tạo sản phẩm!', 'warning');
        setIsAddressPopupOpen(true);
        return;
      }
      openNewProductFormDirectly();
    } catch (error) {
      showToast('Không thể xác thực thông tin địa chỉ giao hàng.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  // Setup form for Edit Product
  const initEditProductForm = async (productId) => {
    try {
      setProductsLoading(true);
      const product = await productService.getById(productId);
      if (!product) return;

      const isAuction = product.status === 'Waiting' || product.status === 'Ready' || product.status === 'AuctionRejected';
      
      setFormData({
        name: product.name || '',
        categoryId: product.categoryId || '',
        description: product.description || '',
        condition: product.condition || 'Used',
        price: product.price || '',
        stockQuantity: product.stockQuantity || '1',
        weightGram: product.weightGram || '',
        lengthCm: product.lengthCm || '',
        widthCm: product.widthCm || '',
        heightCm: product.heightCm || '',
        isForAuction: isAuction,
      });

      // Load attributes values
      const attrs = {};
      (product.attributes || []).forEach((a) => {
        attrs[a.attributeId] = a.value;
      });
      setDynamicAttributes(attrs);
      setValidationErrors({});
      // Load images
      const imgs = (product.images || []).map((i) => ({
        id: i.imageId,
        imageId: i.imageId,
        imageUrl: i.imageUrl,
        altText: i.altText,
        isMain: i.isMain,
      }));
      setImages(imgs);
      setSelectedProductId(productId);
      setActiveTab('edit-product');
    } catch (e) {
      showToast('Failed to retrieve product details.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  // Handle Form Submit (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.categoryId) {
      showToast('Please select a product category.', 'warning');
      return;
    }
    if (images.length === 0) {
      showToast('A product must have at least one image.', 'warning');
      return;
    }

    // Validate all standard fields and category attributes
    const errors = {};
    const standardFields = ['name', 'price', 'stockQuantity', 'weightGram', 'lengthCm', 'widthCm', 'heightCm'];
    standardFields.forEach((field) => {
      const err = validateStandardField(field, formData[field]);
      if (err) {
        errors[field] = err;
      }
    });

    for (const attr of currentCategoryAttributes) {
      const val = dynamicAttributes[attr.attributeId];
      const err = validateAttribute(attr, val);
      if (err) {
        errors[attr.attributeId] = err;
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showToast('Please check and fix input errors.', 'warning');
      return;
    }

    // Map attributes list
    const mappedAttrs = Object.keys(dynamicAttributes).map((key) => ({
      attributeId: key,
      value: dynamicAttributes[key],
    }));

    // Map images list
    const mappedImages = images.map((img, idx) => ({
      imageId: img.imageId || null,
      imageUrl: img.imageUrl,
      altText: img.altText || formData.name,
      isMain: img.isMain,
      sortOrder: idx + 1,
    }));

    const payload = {
      name: formData.name,
      categoryId: formData.categoryId,
      description: formData.description,
      condition: formData.condition,
      price: formData.isForAuction ? null : parseFloat(formData.price),
      stockQuantity: formData.isForAuction ? 1 : parseInt(formData.stockQuantity),
      weightGram: formData.weightGram ? parseInt(formData.weightGram) : null,
      lengthCm: formData.lengthCm ? parseInt(formData.lengthCm) : null,
      widthCm: formData.widthCm ? parseInt(formData.widthCm) : null,
      heightCm: formData.heightCm ? parseInt(formData.heightCm) : null,
      attributes: mappedAttrs,
      images: mappedImages,
    };

    try {
      setProductsLoading(true);
      if (activeTab === 'new-product') {
        payload.isForAuction = formData.isForAuction;
        await productService.create(payload);
        showToast('Product listing created successfully. Waiting for admin approval!', 'success');
      } else {
        await productService.update(selectedProductId, payload);
        showToast('Product updated successfully!', 'success');
      }
      setActiveTab('products');
      fetchMyProducts();
    } catch (error) {
      showToast(error?.response?.data || error?.message || 'An error occurred while saving the product.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product listing?')) return;
    try {
      setProductsLoading(true);
      await productService.delete(productId);
      showToast('Product deleted successfully.', 'success');
      fetchMyProducts();
    } catch (e) {
      showToast(e?.response?.data || 'Failed to delete product.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return { text: 'Pending Approval', cls: 'status-pending' };
      case 'Accepted': return { text: 'Approved for Sale', cls: 'status-accepted' };
      case 'SaleRejected': return { text: 'Sale Rejected', cls: 'status-rejected' };
      case 'Waiting': return { text: 'Pending Auction', cls: 'status-waiting' };
      case 'Ready': return { text: 'Ready for Auction', cls: 'status-ready' };
      case 'AuctionRejected': return { text: 'Auction Rejected', cls: 'status-rejected' };
      case 'Sold': return { text: 'Sold', cls: 'status-sold' };
      case 'Inactive': return { text: 'Inactive', cls: 'status-inactive' };
      default: return { text: status, cls: 'status-unknown' };
    }
  };

  const productStats = useMemo(() => {
    const total = myProducts.length;
    const approved = myProducts.filter((product) => product.status === 'Accepted').length;
    const pending = myProducts.filter((product) => product.status === 'Pending' || product.status === 'Waiting').length;
    const auctionReady = myProducts.filter((product) => product.status === 'Ready').length;
    const sold = myProducts.filter((product) => product.status === 'Sold').length;
    const rejected = myProducts.filter((product) => product.status === 'SaleRejected' || product.status === 'AuctionRejected').length;
    const lowStock = myProducts.filter((product) => Number(product.stockQuantity || 0) <= 2 && product.status !== 'Sold').length;

    return {
      total,
      approved,
      pending,
      auctionReady,
      sold,
      rejected,
      lowStock,
      approvalRate: total ? Math.round((approved / total) * 100) : 0,
    };
  }, [myProducts]);

  const overviewMetrics = [
    { icon: 'inventory_2', label: 'Total Listings', value: productStats.total, note: 'Products in your shop' },
    { icon: 'verified', label: 'Approved', value: productStats.approved, note: 'Ready for buyers' },
    { icon: 'hourglass_top', label: 'In Review', value: productStats.pending, note: 'Waiting platform action' },
    { icon: 'priority_high', label: 'Low Stock', value: productStats.lowStock, note: 'Needs attention', hot: productStats.lowStock > 0 },
  ];

  const recentProducts = myProducts.slice(0, 4);

  return (
    <>
        {productsLoading && (
          <div className="seller-loader-overlay">
            <span className="btn-spinner"></span>
          </div>
        )}

        {/* VIEW 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="tab-dashboard animate-fade-in">
            <header className="seller-overview-hero">
              <div className="seller-overview-copy">
                <span>Seller Overview</span>
                <h1>Good to see you, {user?.firstName || user?.username || 'Seller'}.</h1>
                <p>Keep listings healthy, prepare orders, and move quickly on products that need attention.</p>
              </div>
              <div className="seller-overview-actions">
                <button type="button" className="seller-list-btn" onClick={initNewProductForm}>
                  <span className="material-symbols-outlined">add</span>Add New Product
                </button>
                <Link to="/seller-dashboard/orders">
                  <span className="material-symbols-outlined">orders</span>Manage Orders
                </Link>
                <Link to="/seller-dashboard/sales-statistics">
                  <span className="material-symbols-outlined">monitoring</span>Sales Statistics
                </Link>
              </div>
            </header>

            <section className="seller-metric-grid">
              {overviewMetrics.map((metric) => (
                <article key={metric.label} className={`seller-metric-card ${metric.hot ? 'attention' : ''}`}>
                  <div className="seller-metric-top">
                    <span className="material-symbols-outlined">{metric.icon}</span>
                    <em>{metric.note}</em>
                  </div>
                  <p>{metric.label}</p>
                  <strong>{String(metric.value).padStart(2, '0')}</strong>
                </article>
              ))}
            </section>

            <div className="seller-overview-grid">
              <section className="seller-panel seller-health-panel">
                <div className="seller-panel-header">
                  <div>
                    <h2>Listing Health</h2>
                    <p>Track approval, stock, and auction readiness from your current catalog.</p>
                  </div>
                </div>
                <div className="seller-health-overview">
                  <div className="seller-health-score">
                    <strong>{productStats.approvalRate}%</strong>
                    <span>Approval Rate</span>
                  </div>
                  <div className="seller-health-lines">
                    <div>
                      <span>Approved listings</span>
                      <b>{productStats.approved}/{productStats.total || 0}</b>
                      <i><em style={{ width: `${productStats.approvalRate}%` }} /></i>
                    </div>
                    <div>
                      <span>Auction ready</span>
                      <b>{productStats.auctionReady}</b>
                      <i><em style={{ width: `${Math.min(100, productStats.auctionReady * 20)}%` }} /></i>
                    </div>
                    <div>
                      <span>Needs fix</span>
                      <b>{productStats.rejected + productStats.lowStock}</b>
                      <i><em className="warning" style={{ width: `${Math.min(100, (productStats.rejected + productStats.lowStock) * 18)}%` }} /></i>
                    </div>
                  </div>
                </div>
              </section>

              <section className="seller-panel seller-action-panel">
                <h2>Today Focus</h2>
                <div className="seller-focus-list">
                  <button type="button" onClick={() => setActiveTab('products')}>
                    <span className="material-symbols-outlined">inventory</span>
                    <strong>Review product list</strong>
                    <small>{productStats.pending} listing waiting for approval</small>
                  </button>
                  <Link to="/seller-dashboard/orders">
                    <span className="material-symbols-outlined">local_shipping</span>
                    <strong>Check fulfillment</strong>
                    <small>Confirm and ship buyer orders</small>
                  </Link>
                  <button type="button" onClick={initNewProductForm}>
                    <span className="material-symbols-outlined">add_box</span>
                    <strong>Create new listing</strong>
                    <small>Add photos, specs, and stock</small>
                  </button>
                </div>
              </section>
            </div>

            <section className="seller-panel seller-recent-panel">
              <div className="seller-panel-header">
                <div>
                  <h2>Recent Listings</h2>
                  <p>Newest products from your shop catalog.</p>
                </div>
                <button type="button" onClick={() => setActiveTab('products')}>View All</button>
              </div>
              {recentProducts.length === 0 ? (
                <div className="seller-overview-empty">
                  <span className="material-symbols-outlined">inventory</span>
                  <strong>No listings yet</strong>
                  <p>Start by creating your first product listing.</p>
                </div>
              ) : (
                <div className="seller-recent-list">
                  {recentProducts.map((product) => {
                    const status = getStatusText(product.status);

                    return (
                      <article key={product.productId}>
                        <img src={product.mainImageUrl || 'https://placehold.co/100'} alt={product.name} />
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.categoryName || 'Uncategorized'} · Stock {product.stockQuantity ?? 0}</span>
                        </div>
                        <em className={`seller-status-chip ${status.cls}`}>{status.text}</em>
                        <b>{product.price ? formatVnd(product.price) : 'Contact'}</b>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW 2: PRODUCT LIST TAB */}
        {activeTab === 'products' && (
          <div className="tab-products animate-fade-in">
            <header className="seller-dash-header">
              <div>
                <h1>My Products</h1>
                <p>View, edit, or delete the products you are selling or auctioning.</p>
              </div>
              <button className="seller-list-btn" onClick={initNewProductForm}>
                <span className="material-symbols-outlined">add</span>Add New Product
              </button>
            </header>

            <section className="seller-panel">
              <div className="seller-dash-filter-bar" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <form onSubmit={handleSellerSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '250px', position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Search by product name..." 
                    value={sellerSearch}
                    onChange={(e) => setSellerSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 40px 10px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)' }}
                  />
                  <button type="submit" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-outlined">search</span>
                  </button>
                </form>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select 
                    value={sellerStatus} 
                    onChange={(e) => setSellerStatus(e.target.value)}
                    style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Accepted">Approved (Sale)</option>
                    <option value="Waiting">Pending Auction</option>
                    <option value="Ready">Ready for Auction</option>
                    <option value="SaleRejected">Sale Rejected</option>
                    <option value="AuctionRejected">Auction Rejected</option>
                    <option value="Sold">Sold</option>
                    <option value="Inactive">Inactive</option>
                  </select>

                  <select 
                    value={sellerSort} 
                    onChange={(e) => setSellerSort(e.target.value)}
                    style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              <div className="seller-products-table-wrap">
                {myProducts.length === 0 ? (
                  <div className="seller-empty-products">
                    <span className="material-symbols-outlined">inventory</span>
                    <h3>No products found</h3>
                    <p>Try adjusting your filters or post a new product.</p>
                    <button className="seller-list-btn" style={{ marginTop: '16px' }} onClick={initNewProductForm}>Post Now</button>
                  </div>
                ) : (
                  <table className="seller-products-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Condition</th>
                        <th>Approval Status</th>
                        <th>Date Posted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myProducts.map((p) => {
                        const status = getStatusText(p.status);
                        const isAuction = p.status === 'Waiting' || p.status === 'Ready' || p.status === 'AuctionRejected';
                        return (
                          <tr key={p.productId}>
                            <td>
                              <div className="seller-prod-identity">
                                <img src={p.mainImageUrl || 'https://placehold.co/100'} alt={p.name} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>{p.productId}</small>
                                </div>
                              </div>
                            </td>
                            <td>{p.categoryName}</td>
                            <td>
                              {isAuction ? (
                                <span className="badge-auct">Auction</span>
                              ) : (
                                <strong>{p.price ? formatVnd(p.price) : 'Contact'}</strong>
                              )}
                            </td>
                            <td>{p.stockQuantity}</td>
                            <td>{p.condition}</td>
                            <td>
                              <span className={`seller-status-chip ${status.cls}`}>{status.text}</span>
                            </td>
                            <td>{p.createdAt ? dateTimeFormatter.format(new Date(p.createdAt)) : '-'}</td>
                            <td>
                              <div className="seller-action-actions">
                                <button type="button" className="seller-icon-action" onClick={() => initEditProductForm(p.productId)}>
                                  <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button type="button" className="seller-icon-action danger" onClick={() => handleDeleteProduct(p.productId)}>
                                  <span className="material-symbols-outlined">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {/* VIEW 3: CREATE / EDIT PRODUCT FORM */}
        {(activeTab === 'new-product' || activeTab === 'edit-product') && (
          <div className="tab-product-form animate-fade-in">
            <header className="seller-dash-header">
              <div>
                <h1>{activeTab === 'new-product' ? 'Post New Product' : 'Edit Product'}</h1>
                <p>Provide detailed information and images for the best listing representation.</p>
              </div>
              <button className="seller-action-btn-back" onClick={() => setActiveTab('products')}>
                <span className="material-symbols-outlined">arrow_back</span>Back to List
              </button>
            </header>

            <form onSubmit={handleSubmit} className="product-form-layout">
              <div className="form-column-left">
                {/* 1. General Information */}
                <div className="form-card">
                  <h2>General Information</h2>
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g. iPhone 15 Pro Max 256GB Gold"
                      className={validationErrors.name ? 'has-error' : ''}
                    />
                    {validationErrors.name && <span className="input-error-msg">{validationErrors.name}</span>}
                  </div>
                  
                  <div className="form-group-row">
                    <div className="form-group">
                      <label>Product Category *</label>
                      <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} required className={validationErrors.categoryId ? 'has-error' : ''}>
                        <option value="">-- Select Category --</option>
                        {categories.map((c) => (
                          <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                        ))}
                      </select>
                      {validationErrors.categoryId && <span className="input-error-msg">{validationErrors.categoryId}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label>Product Condition</label>
                      <select name="condition" value={formData.condition} onChange={handleInputChange}>
                        <option value="New (Sealed)">New (Sealed)</option>
                        <option value="Like New (99%)">Like New (99%)</option>
                        <option value="Used">Used</option>
                        <option value="Heavily Used">Heavily Used</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Detailed Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={6} placeholder="Detailed description of the product, minor defects if any, included accessories..." />
                  </div>
                </div>

                {/* 2. Listing Format & Stock */}
                <div className="form-card">
                  <h2>Listing Format & Stock</h2>
                  
                  {activeTab === 'new-product' ? (
                    <div className="form-toggle-group">
                      <label className="toggle-label">
                        <input type="checkbox" name="isForAuction" checked={formData.isForAuction} onChange={handleAuctionToggle} />
                        <span className="toggle-custom-box"></span>
                        List as an Auction
                      </label>
                      <p className="toggle-help-text">Auction products will be approved to join a dedicated room. The starting price will be configured in the Auction flow.</p>
                    </div>
                  ) : (
                    <div className="auction-static-info">
                      <strong>Format: </strong>
                      <span className={`badge ${formData.isForAuction ? 'badge-auction' : 'badge-pending'}`}>
                        {formData.isForAuction ? 'Auction' : 'Sale'}
                      </span>
                    </div>
                  )}

                  <div className="form-group-row">
                    <div className="form-group">
                      <label>Price (VND) {!formData.isForAuction && '*'}</label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        disabled={formData.isForAuction}
                        required={!formData.isForAuction}
                        placeholder={formData.isForAuction ? "Set in Auction" : "e.g. 15000000"}
                        className={validationErrors.price ? 'has-error' : ''}
                      />
                      {validationErrors.price && <span className="input-error-msg">{validationErrors.price}</span>}
                    </div>

                    <div className="form-group">
                      <label>Stock Quantity *</label>
                      <input
                        type="number"
                        name="stockQuantity"
                        value={formData.stockQuantity}
                        onChange={handleInputChange}
                        disabled={formData.isForAuction}
                        required
                        min="1"
                        className={validationErrors.stockQuantity ? 'has-error' : ''}
                      />
                      {validationErrors.stockQuantity && <span className="input-error-msg">{validationErrors.stockQuantity}</span>}
                    </div>
                  </div>
                </div>

                {/* 3. Package weight & size */}
                <div className="form-card">
                  <h2>Weight & Packaging Dimensions</h2>
                  <p className="form-section-subtitle">Used for automatic shipping fee calculation</p>
                  
                  <div className="form-group">
                    <label>Weight (Grams)</label>
                    <input
                      type="number"
                      name="weightGram"
                      value={formData.weightGram}
                      onChange={handleInputChange}
                      placeholder="e.g. 200"
                      className={validationErrors.weightGram ? 'has-error' : ''}
                    />
                    {validationErrors.weightGram && <span className="input-error-msg">{validationErrors.weightGram}</span>}
                  </div>

                  <div className="form-group-triple">
                    <div className="form-group">
                      <label>Length (Cm)</label>
                      <input
                        type="number"
                        name="lengthCm"
                        value={formData.lengthCm}
                        onChange={handleInputChange}
                        placeholder="Length"
                        className={validationErrors.lengthCm ? 'has-error' : ''}
                      />
                      {validationErrors.lengthCm && <span className="input-error-msg">{validationErrors.lengthCm}</span>}
                    </div>
                    <div className="form-group">
                      <label>Width (Cm)</label>
                      <input
                        type="number"
                        name="widthCm"
                        value={formData.widthCm}
                        onChange={handleInputChange}
                        placeholder="Width"
                        className={validationErrors.widthCm ? 'has-error' : ''}
                      />
                      {validationErrors.widthCm && <span className="input-error-msg">{validationErrors.widthCm}</span>}
                    </div>
                    <div className="form-group">
                      <label>Height (Cm)</label>
                      <input
                        type="number"
                        name="heightCm"
                        value={formData.heightCm}
                        onChange={handleInputChange}
                        placeholder="Height"
                        className={validationErrors.heightCm ? 'has-error' : ''}
                      />
                      {validationErrors.heightCm && <span className="input-error-msg">{validationErrors.heightCm}</span>}
                    </div>
                  </div>
                </div>

                {/* 4. Specifications (Category Attributes) */}
                {currentCategoryAttributes.length > 0 && (
                  <div className="form-card">
                    <h2>Specifications (Category Attributes)</h2>
                    <p className="form-section-subtitle">Entering detailed attributes helps make your product easier to search</p>
                    
                    <div className="dynamic-attributes-grid">
                      {currentCategoryAttributes.map((attr) => (
                        <div className="form-group" key={attr.attributeId}>
                          <label>
                            {attr.name} {attr.isRequired && '*'} {attr.unit && `(${attr.unit})`}
                          </label>
                          <input
                            type={attr.dataType === 'Number' ? 'number' : 'text'}
                            value={dynamicAttributes[attr.attributeId] || ''}
                            onChange={(e) => handleAttrChange(attr.attributeId, e.target.value)}
                            required={attr.isRequired}
                            placeholder={attr.dataType === 'Number' ? 'Numbers only' : `Enter ${attr.name.toLowerCase()}`}
                            className={validationErrors[attr.attributeId] ? 'has-error' : ''}
                          />
                          {validationErrors[attr.attributeId] && <span className="input-error-msg">{validationErrors[attr.attributeId]}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-column-right">
                {/* 5. Image Management */}
                <div className="form-card">
                  <h2>Product Images *</h2>
                  <p className="form-section-subtitle">Upload at least 1 image. Select the radio button below an image to make it the Primary Image.</p>
                  
                  <div className="image-upload-wrapper">
                    <label className="image-upload-btn">
                      <span className="material-symbols-outlined">cloud_upload</span>
                      Upload Image to Cloudinary
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div className="uploaded-images-preview-grid">
                    {images.map((img, idx) => (
                      <div className={`uploaded-img-card ${img.isMain ? 'is-main-card' : ''}`} key={img.id}>
                        <img src={img.imageUrl} alt={img.altText} />
                        
                        <div className="img-card-actions">
                          <label className="main-radio-label">
                            <input
                              type="radio"
                              name="main-image-selection"
                              checked={!!img.isMain}
                              onChange={() => handleSetMainImage(img.id)}
                            />
                            <span>Primary</span>
                          </label>
                          
                          <button type="button" className="remove-img-btn" onClick={() => handleRemoveImage(img.id)}>
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="image-tip-notice">
                    <span className="material-symbols-outlined">info</span>
                    <p>Tip: You should use high-quality actual photos, 4:3 or 1:1 ratio, showing clear details to increase approval rate.</p>
                  </div>
                </div>

                <div className="form-submit-card">
                  <button type="submit" className="btn-submit-product">
                    <span className="material-symbols-outlined">save</span>
                    {activeTab === 'new-product' ? 'Submit Product' : 'Save Changes'}
                  </button>
                  
                  <button type="button" className="btn-cancel-product" onClick={() => setActiveTab('products')}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {isAddressPopupOpen && (
          <AddressPopup 
            onClose={() => setIsAddressPopupOpen(false)} 
            onSelect={(selectedAddr) => {
              setIsAddressPopupOpen(false);
              showToast('Đã thêm địa chỉ thành công! Giờ bạn có thể tạo sản phẩm.', 'success');
              openNewProductFormDirectly();
            }} 
          />
        )}
    </>
  );
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}
