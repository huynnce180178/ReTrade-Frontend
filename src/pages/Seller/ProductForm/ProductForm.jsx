import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';

import { useLanguage } from '../../../context/LanguageContext';

export default function ProductForm() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const isEdit = Boolean(productId);

  const [productsLoading, setProductsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Category Request Modal States
  const [isCategoryRequestModalOpen, setIsCategoryRequestModalOpen] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqParentId, setReqParentId] = useState('');
  const [reqAttributes, setReqAttributes] = useState([]);
  
  const [formData, setFormData] = useState({
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
  
  const [images, setImages] = useState([]);
  const [dynamicAttributes, setDynamicAttributes] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isEdit && productId) {
      initEditProductForm(productId);
    } else {
      // Setup empty form
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
    }
  }, [isEdit, productId]);

  const fetchCategories = async () => {
    try {
      const res = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc");
      setCategories(Array.isArray(res) ? res : (res?.value || []));
    } catch (e) {
      showToast('Failed to load categories.', 'error');
    }
  };

  const handleAddReqAttributeRow = () => {
    setReqAttributes((prev) => [
      ...prev,
      {
        name: '',
        dataType: 'String',
        isRequired: false,
        minValue: null,
        maxValue: null,
        unit: '',
        isFilterable: false,
        isSearchable: false,
      },
    ]);
  };

  const handleRemoveReqAttributeRow = (index) => {
    setReqAttributes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleReqAttributeChange = (index, field, val) => {
    setReqAttributes((prev) =>
      prev.map((attr, idx) => (idx === index ? { ...attr, [field]: val } : attr))
    );
  };

  const handleSaveCategoryRequest = async (e) => {
    e.preventDefault();
    if (!reqName.trim()) {
      showToast('Category name is required.', 'warning');
      return;
    }

    // Validate attributes
    for (let attr of reqAttributes) {
      if (!attr.name.trim()) {
        showToast('All attribute names must be filled out.', 'warning');
        return;
      }
    }

    const payload = {
      name: reqName.trim(),
      description: reqDescription.trim(),
      parentId: reqParentId || null,
      status: 'Pending',
      attributes: reqAttributes.map((a, index) => ({
        name: a.name.trim(),
        dataType: a.dataType,
        isRequired: a.isRequired,
        minValue: a.dataType === 'Number' && a.minValue !== '' && a.minValue !== null ? parseFloat(a.minValue) : null,
        maxValue: a.dataType === 'Number' && a.maxValue !== '' && a.maxValue !== null ? parseFloat(a.maxValue) : null,
        unit: a.unit?.trim() || null,
        displayOrder: index + 1,
        isFilterable: a.isFilterable || false,
        isSearchable: a.isSearchable || false
      }))
    };

    try {
      showToast('Submitting category request...', 'info');
      const newCategory = await categoryService.create(payload);
      showToast('Category request submitted successfully! Waiting for Admin approval.', 'success');
      
      setCategories(prev => [...prev, newCategory]);
      setFormData(prev => ({ ...prev, categoryId: newCategory.categoryId }));

      // Reset request states
      setReqName('');
      setReqDescription('');
      setReqParentId('');
      setReqAttributes([]);
      setIsCategoryRequestModalOpen(false);
    } catch (err) {
      const errMsg = err?.response?.data || t('common.category_request_error');
      showToast(errMsg, 'error');
    }
  };

  const initEditProductForm = async (id) => {
    try {
      setProductsLoading(true);
      const product = await productService.getById(id);
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

      const attrs = {};
      (product.attributes || []).forEach((a) => {
        attrs[a.attributeId] = a.value;
      });
      setDynamicAttributes(attrs);
      setValidationErrors({});
      
      const imgs = (product.images || []).map((i) => ({
        id: i.imageId,
        imageId: i.imageId,
        imageUrl: i.imageUrl,
        altText: i.altText,
        isMain: i.isMain,
      }));
      setImages(imgs);
    } catch (e) {
      showToast('Failed to retrieve product details.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const currentCategoryAttributes = useMemo(() => {
    if (!formData.categoryId) return [];
    const cat = categories.find((c) => c.categoryId === formData.categoryId);
    return (cat?.attributes || []).filter(a => !a.isDeleted);
  }, [formData.categoryId, categories]);

  const validateAttribute = (attr, val) => {
    const isProvided = val !== undefined && val !== null && String(val).trim() !== '';
    if (attr.isRequired && !isProvided) return `"${attr.name}" is required.`;
    if (isProvided) {
      if (attr.dataType === 'Number') {
        const numVal = Number(val);
        if (isNaN(numVal)) return `"${attr.name}" must be a valid number.`;
        if (attr.minValue !== undefined && attr.minValue !== null && numVal < attr.minValue) return `"${attr.name}" must be greater than or equal to ${attr.minValue}.`;
        if (attr.maxValue !== undefined && attr.maxValue !== null && numVal > attr.maxValue) return `"${attr.name}" must be less than or equal to ${attr.maxValue}.`;
      }
    }
    return '';
  };

  const validateStandardField = (name, value, isAuction = formData.isForAuction) => {
    switch (name) {
      case 'name':
        if (!value || String(value).trim() === '') return 'Product name cannot be empty.';
        break;
      case 'price':
        if (!isAuction) {
          const numPrice = parseFloat(value);
          if (isNaN(numPrice) || numPrice <= 0) return 'Price must be greater than 0.';
        }
        break;
      case 'stockQuantity':
        if (!isAuction) {
          const numStock = parseInt(value, 10);
          if (isNaN(numStock) || numStock < 1) return 'Stock quantity must be at least 1.';
        }
        break;
      case 'weightGram':
        if (value) {
          const numVal = parseInt(value, 10);
          if (isNaN(numVal) || numVal <= 0) return 'Weight must be greater than 0.';
        }
        break;
      case 'lengthCm':
      case 'widthCm':
      case 'heightCm':
        if (value) {
          const numVal = parseInt(value, 10);
          if (isNaN(numVal) || numVal <= 0) return 'Dimension must be greater than 0.';
        }
        break;
      default: return '';
    }
    return '';
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'categoryId' && value === 'other_request') {
      setIsCategoryRequestModalOpen(true);
      setFormData((prev) => ({
        ...prev,
        categoryId: '',
      }));
      return;
    }

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
      setValidationErrors((prev) => ({ ...prev, [name]: errorMsg }));
    }
  };

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

  const handleAttrChange = (attributeId, value) => {
    setDynamicAttributes((prev) => ({ ...prev, [attributeId]: value }));

    const attrTemplate = currentCategoryAttributes.find((a) => a.attributeId === attributeId);
    if (attrTemplate) {
      const errorMsg = validateAttribute(attrTemplate, value);
      setValidationErrors((prev) => ({ ...prev, [attributeId]: errorMsg }));
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const fakeEvent = { target: { files, value: '' } };
    await handleImageUpload(fakeEvent);
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setProductsLoading(true);
      const uploadedImages = [];
      let isFirst = images.length === 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await productService.uploadImage(file);
        if (res && res.imageUrl) {
          uploadedImages.push({
            id: Date.now().toString() + i,
            imageUrl: res.imageUrl,
            altText: formData.name || t('common.product_image'),
            isMain: isFirst,
          });
          isFirst = false;
        }
      }
      
      if (uploadedImages.length > 0) {
        setImages((prev) => [...prev, ...uploadedImages]);
        showToast(t('common.upload_success', { count: uploadedImages.length }), 'success');
      }
    } catch (err) {
      showToast(t('common.upload_error'), 'error');
    } finally {
      setProductsLoading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imgId) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.id !== imgId && i.imageId !== imgId);
      const wasMain = prev.find((i) => i.id === imgId || i.imageId === imgId)?.isMain;
      if (wasMain && filtered.length > 0) {
        filtered[0].isMain = true;
      }
      return filtered;
    });
  };

  const handleSetMainImage = (imgId) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isMain: img.id === imgId || img.imageId === imgId,
      }))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.categoryId) {
      showToast(t('common.select_category_warning'), 'warning');
      return;
    }
    if (images.length === 0) {
      showToast(t('common.image_required'), 'warning');
      return;
    }

    const errors = {};
    const standardFields = ['name', 'price', 'stockQuantity', 'weightGram', 'lengthCm', 'widthCm', 'heightCm'];
    standardFields.forEach((field) => {
      const err = validateStandardField(field, formData[field]);
      if (err) errors[field] = err;
    });

    for (const attr of currentCategoryAttributes) {
      const val = dynamicAttributes[attr.attributeId];
      const err = validateAttribute(attr, val);
      if (err) errors[attr.attributeId] = err;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showToast(t('common.fix_errors'), 'warning');
      return;
    }

    const mappedAttrs = Object.keys(dynamicAttributes).map((key) => ({
      attributeId: key,
      value: dynamicAttributes[key],
    }));

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
      if (!isEdit) {
        payload.isForAuction = formData.isForAuction;
        await productService.create(payload);
        showToast(t('common.product_created'), 'success');
      } else {
        await productService.update(productId, payload);
        showToast(t('common.product_updated'), 'success');
      }
      navigate('/seller-dashboard/products');
    } catch (error) {
      showToast(error?.response?.data || error?.message || t('common.save_error'), 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  return (
    <>
      {productsLoading && (
        <div className="seller-loader-overlay">
          <span className="btn-spinner"></span>
        </div>
      )}

      <div className="tab-product-form animate-fade-in">
        <header className="seller-dash-header">
          <div>
            <h1>{!isEdit ? (isVi ? 'Đăng Sản Phẩm Mới' : 'Post New Product') : (isVi ? 'Chỉnh Sửa Sản Phẩm' : 'Edit Product')}</h1>
            <p>{isVi ? 'Cung cấp thông tin chi tiết và hình ảnh để tin đăng đạt chất lượng tốt nhất.' : 'Provide detailed information and images for the best listing representation.'}</p>
          </div>
          <button className="seller-action-btn-back" onClick={() => navigate('/seller-dashboard/products')}>
            <span className="material-symbols-outlined">arrow_back</span>{isVi ? 'Quay lại danh sách' : 'Back to List'}
          </button>
        </header>

        <form onSubmit={handleSubmit} className="product-form-layout">
          <div className="form-column-left">
            <div className="form-card">
              <h2>{isVi ? 'Thông Tin Chung' : 'General Information'}</h2>
              <div className="form-group">
                <label>{isVi ? 'Tên Sản Phẩm *' : 'Product Name *'}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder={isVi ? 'Ví dụ: iPhone 15 Pro Max 256GB Vàng' : 'e.g. iPhone 15 Pro Max 256GB Gold'}
                  className={validationErrors.name ? 'has-error' : ''}
                />
                {validationErrors.name && <span className="input-error-msg">{validationErrors.name}</span>}
              </div>
              
              <div className="form-group-row">
                <div className="form-group">
                  <label>{isVi ? 'Danh Mục Sản Phẩm *' : 'Product Category *'}</label>
                   <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} required className={validationErrors.categoryId ? 'has-error' : ''}>
                    <option value="">{isVi ? '-- Chọn Danh Mục --' : '-- Select Category --'}</option>
                    {categories.filter(c => c.status === 'Active' || c.status === 'Pending').map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.name} {c.status === 'Pending' ? (isVi ? '(Chờ duyệt)' : '(Pending Approval)') : ''}
                      </option>
                    ))}
                    <option value="other_request" style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{isVi ? '+ Yêu cầu danh mục mới...' : '+ Request New Category...'}</option>
                  </select>
                  {validationErrors.categoryId && <span className="input-error-msg">{validationErrors.categoryId}</span>}
                </div>
                
                <div className="form-group">
                  <label>{isVi ? 'Tình Trạng Sản Phẩm' : 'Product Condition'}</label>
                  <select name="condition" value={formData.condition} onChange={handleInputChange}>
                    <option value="New">{isVi ? 'Mới (Nguyên niêm phong)' : 'New (Sealed)'}</option>
                    <option value="LikeNew">{isVi ? 'Như mới (99%)' : 'Like New (99%)'}</option>
                    <option value="Excellent">{isVi ? 'Rất tốt' : 'Excellent'}</option>
                    <option value="Good">{isVi ? 'Tốt' : 'Good'}</option>
                    <option value="Fair">{isVi ? 'Khá' : 'Fair'}</option>
                    <option value="Used">{isVi ? 'Đã qua sử dụng' : 'Used'}</option>
                    <option value="Damaged">{isVi ? 'Có trầy xước / Hỏng nhẹ' : 'Damaged'}</option>
                    <option value="ForParts">{isVi ? 'Bán xác / Linh kiện' : 'For Parts'}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{isVi ? 'Mô Tả Chi Tiết' : 'Detailed Description'}</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={6} placeholder={isVi ? 'Mô tả chi tiết sản phẩm, các vết xước nhỏ nếu có, phụ kiện đi kèm...' : 'Detailed description of the product, minor defects if any, included accessories...'} />
              </div>
            </div>

            <div className="form-card">
              <h2>{isVi ? 'Hình Thức Đăng & Tồn Kho' : 'Listing Format & Stock'}</h2>
              
              {!isEdit ? (
                <div className="form-toggle-group">
                  <label className="toggle-label">
                    <input type="checkbox" name="isForAuction" checked={formData.isForAuction} onChange={handleAuctionToggle} />
                    <span className="toggle-custom-box"></span>
                    {isVi ? 'Đăng Dưới Dạng Đấu Giá' : 'List as an Auction'}
                  </label>
                  <p className="toggle-help-text">{isVi ? 'Sản phẩm đấu giá sẽ được duyệt để tham gia phòng đấu giá riêng.' : 'Auction products will be approved to join a dedicated room.'}</p>
                </div>
              ) : (
                <div className="auction-static-info">
                  <strong>{isVi ? 'Hình thức: ' : 'Format: '}</strong>
                  <span className={`badge ${formData.isForAuction ? 'badge-auction' : 'badge-pending'}`}>
                    {formData.isForAuction ? (isVi ? 'Đấu giá' : 'Auction') : (isVi ? 'Bán thẳng' : 'Sale')}
                  </span>
                </div>
              )}

              <div className="form-group-row">
                <div className="form-group">
                  <label>{isVi ? 'Giá (VND)' : 'Price (VND)'} {!formData.isForAuction && '*'}</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    disabled={formData.isForAuction}
                    required={!formData.isForAuction}
                    placeholder={formData.isForAuction ? (isVi ? 'Thiết lập khi Đấu Giá' : 'Set in Auction') : (isVi ? 'Ví dụ: 15000000' : 'e.g. 15000000')}
                    className={validationErrors.price ? 'has-error' : ''}
                  />
                  {validationErrors.price && <span className="input-error-msg">{validationErrors.price}</span>}
                </div>

                <div className="form-group">
                  <label>{isVi ? 'Số Lượng Tồn Kho *' : 'Stock Quantity *'}</label>
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

            <div className="form-card">
              <h2>{isVi ? 'Trọng Lượng & Kích Thước Đóng Gói' : 'Weight & Packaging Dimensions'}</h2>
              <p className="form-section-subtitle">{isVi ? 'Dùng để tính phí vận chuyển tự động' : 'Used for automatic shipping fee calculation'}</p>
              
              <div className="form-group">
                <label>{isVi ? 'Trọng Lượng (Gram)' : 'Weight (Grams)'}</label>
                <input
                  type="number"
                  name="weightGram"
                  value={formData.weightGram}
                  onChange={handleInputChange}
                  placeholder={isVi ? 'Ví dụ: 200' : 'e.g. 200'}
                  className={validationErrors.weightGram ? 'has-error' : ''}
                />
                {validationErrors.weightGram && <span className="input-error-msg">{validationErrors.weightGram}</span>}
              </div>

              <div className="form-group-triple">
                <div className="form-group">
                  <label>{isVi ? 'Chiều Dài (Cm)' : 'Length (Cm)'}</label>
                  <input
                    type="number"
                    name="lengthCm"
                    value={formData.lengthCm}
                    onChange={handleInputChange}
                    placeholder={isVi ? 'Dài' : 'Length'}
                    className={validationErrors.lengthCm ? 'has-error' : ''}
                  />
                  {validationErrors.lengthCm && <span className="input-error-msg">{validationErrors.lengthCm}</span>}
                </div>
                <div className="form-group">
                  <label>{isVi ? 'Chiều Rộng (Cm)' : 'Width (Cm)'}</label>
                  <input
                    type="number"
                    name="widthCm"
                    value={formData.widthCm}
                    onChange={handleInputChange}
                    placeholder={isVi ? 'Rộng' : 'Width'}
                    className={validationErrors.widthCm ? 'has-error' : ''}
                  />
                  {validationErrors.widthCm && <span className="input-error-msg">{validationErrors.widthCm}</span>}
                </div>
                <div className="form-group">
                  <label>{isVi ? 'Chiều Cao (Cm)' : 'Height (Cm)'}</label>
                  <input
                    type="number"
                    name="heightCm"
                    value={formData.heightCm}
                    onChange={handleInputChange}
                    placeholder={isVi ? 'Cao' : 'Height'}
                    className={validationErrors.heightCm ? 'has-error' : ''}
                  />
                  {validationErrors.heightCm && <span className="input-error-msg">{validationErrors.heightCm}</span>}
                </div>
              </div>
            </div>

            {currentCategoryAttributes.length > 0 && (
              <div className="form-card">
                <h2>{isVi ? 'Thông Số Kỹ Thuật (Đặc Tính Danh Mục)' : 'Specifications (Category Attributes)'}</h2>
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
                        placeholder={attr.dataType === 'Number' ? (isVi ? 'Chỉ nhập số' : 'Numbers only') : (isVi ? `Nhập ${attr.name.toLowerCase()}` : `Enter ${attr.name.toLowerCase()}`)}
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
            <div className="form-card">
              <h2>{isVi ? 'Hình Ảnh Sản Phẩm *' : 'Product Images *'}</h2>
              <div
                className={`image-upload-wrapper ${isDragging ? 'is-dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <label className="image-upload-btn">
                  <span className="material-symbols-outlined">cloud_upload</span>
                  {isVi ? 'Tải Ảnh Lên Hoặc Kéo-Thả Vào Đây' : 'Upload Or Drag & Drop Image Here'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
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
                        <span>{isVi ? 'Ảnh chính' : 'Primary'}</span>
                      </label>
                      <button type="button" className="remove-img-btn" onClick={() => handleRemoveImage(img.id)}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-submit-card">
              <button type="submit" className="btn-submit-product">
                <span className="material-symbols-outlined">save</span>
                {!isEdit ? (isVi ? 'Đăng Sản Phẩm' : 'Submit Product') : (isVi ? 'Lưu Thay Đổi' : 'Save Changes')}
              </button>
              
              <button type="button" className="btn-cancel-product" onClick={() => navigate('/seller-dashboard/products')}>
                {isVi ? 'Hủy Bỏ' : 'Cancel'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Category Request Modal */}
      {isCategoryRequestModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsCategoryRequestModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request New Category</h3>
              <button className="modal-close-btn" onClick={() => setIsCategoryRequestModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCategoryRequest} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={reqName} 
                    onChange={(e) => setReqName(e.target.value)} 
                    required 
                    placeholder="e.g. Vintage Books"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category</label>
                  <select 
                    className="form-input" 
                    value={reqParentId} 
                    onChange={(e) => setReqParentId(e.target.value)}
                  >
                    <option value="">None (Root Category)</option>
                    {categories.map(c => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={reqDescription} 
                    onChange={(e) => setReqDescription(e.target.value)}
                    placeholder="Provide details about the category..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Specifications & Attributes</span>
                    <button type="button" className="add-attr-trigger" onClick={handleAddReqAttributeRow}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                      Add Attribute
                    </button>
                  </label>

                  <div className="attributes-creator-widget">
                    {reqAttributes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                        No attributes configured. Click &quot;Add Attribute&quot; to add specifications.
                      </p>
                    ) : (
                      reqAttributes.map((attr, idx) => (
                        <div key={idx} className="attribute-card-item">
                          <div className="attribute-card-header">
                            <input 
                              type="text" 
                              className="form-input attr-name-input" 
                              placeholder="Attribute Name (e.g. Page Count)" 
                              value={attr.name}
                              onChange={(e) => handleReqAttributeChange(idx, 'name', e.target.value)}
                              required
                            />
                            <select 
                              className="form-input attr-type-select" 
                              value={attr.dataType}
                              onChange={(e) => handleReqAttributeChange(idx, 'dataType', e.target.value)}
                            >
                              <option value="String">String</option>
                              <option value="Number">Number</option>
                              <option value="Boolean">Boolean</option>
                              <option value="DateTime">DateTime</option>
                            </select>
                            <button type="button" className="attr-action-btn" onClick={() => handleRemoveReqAttributeRow(idx)} title="Delete attribute">
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                          
                          <div className="attribute-card-settings">
                            <div className="settings-field">
                              <label>Unit</label>
                              <input 
                                type="text" 
                                className="form-input input-sm" 
                                placeholder="e.g. pages, cm" 
                                value={attr.unit || ''}
                                onChange={(e) => handleReqAttributeChange(idx, 'unit', e.target.value)}
                              />
                            </div>
                            
                            {attr.dataType === 'Number' && (
                              <>
                                <div className="settings-field">
                                  <label>Min Value</label>
                                  <input 
                                    type="number" 
                                    step="any"
                                    className="form-input input-sm" 
                                    placeholder="Min" 
                                    value={attr.minValue !== null && attr.minValue !== undefined ? attr.minValue : ''}
                                    onChange={(e) => handleReqAttributeChange(idx, 'minValue', e.target.value === '' ? null : e.target.value)}
                                  />
                                </div>
                                <div className="settings-field">
                                  <label>Max Value</label>
                                  <input 
                                    type="number" 
                                    step="any"
                                    className="form-input input-sm" 
                                    placeholder="Max" 
                                    value={attr.maxValue !== null && attr.maxValue !== undefined ? attr.maxValue : ''}
                                    onChange={(e) => handleReqAttributeChange(idx, 'maxValue', e.target.value === '' ? null : e.target.value)}
                                  />
                                </div>
                              </>
                            )}
                            
                            <div className="checkboxes-group">
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isRequired || false}
                                  onChange={(e) => handleReqAttributeChange(idx, 'isRequired', e.target.checked)}
                                />
                                <span>Required</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isFilterable || false}
                                  onChange={(e) => handleReqAttributeChange(idx, 'isFilterable', e.target.checked)}
                                />
                                <span>Filterable</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isSearchable || false}
                                  onChange={(e) => handleReqAttributeChange(idx, 'isSearchable', e.target.checked)}
                                />
                                <span>Searchable</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryRequestModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
