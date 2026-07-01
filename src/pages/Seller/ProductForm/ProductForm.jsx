import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';

export default function ProductForm() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { productId } = useParams();
  const { showToast } = useToast();

  const isEdit = Boolean(productId);

  const [productsLoading, setProductsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  
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
      const res = await categoryService.getAll();
      setCategories(Array.isArray(res) ? res : (res?.value || []));
    } catch (e) {
      showToast('Failed to load categories.', 'error');
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
    return cat?.attributes || [];
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
            altText: formData.name || 'Product Image',
            isMain: isFirst,
          });
          isFirst = false;
        }
      }
      
      if (uploadedImages.length > 0) {
        setImages((prev) => [...prev, ...uploadedImages]);
        showToast(`Uploaded ${uploadedImages.length} image(s) successfully.`, 'success');
      }
    } catch (err) {
      showToast('Failed to upload image.', 'error');
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
      showToast('Please select a product category.', 'warning');
      return;
    }
    if (images.length === 0) {
      showToast('A product must have at least one image.', 'warning');
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
      showToast('Please check and fix input errors.', 'warning');
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
        showToast('Product listing created successfully. Waiting for admin approval!', 'success');
      } else {
        await productService.update(productId, payload);
        showToast('Product updated successfully!', 'success');
      }
      navigate('/seller-dashboard/products');
    } catch (error) {
      showToast(error?.response?.data || error?.message || 'An error occurred while saving the product.', 'error');
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
            <h1>{!isEdit ? 'Post New Product' : 'Edit Product'}</h1>
            <p>Provide detailed information and images for the best listing representation.</p>
          </div>
          <button className="seller-action-btn-back" onClick={() => navigate('/seller-dashboard/products')}>
            <span className="material-symbols-outlined">arrow_back</span>Back to List
          </button>
        </header>

        <form onSubmit={handleSubmit} className="product-form-layout">
          <div className="form-column-left">
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
                    <option value="New">New (Sealed)</option>
                    <option value="LikeNew">Like New (99%)</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Used">Used</option>
                    <option value="Damaged">Damaged</option>
                    <option value="ForParts">For Parts</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Detailed Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={6} placeholder="Detailed description of the product, minor defects if any, included accessories..." />
              </div>
            </div>

            <div className="form-card">
              <h2>Listing Format & Stock</h2>
              
              {!isEdit ? (
                <div className="form-toggle-group">
                  <label className="toggle-label">
                    <input type="checkbox" name="isForAuction" checked={formData.isForAuction} onChange={handleAuctionToggle} />
                    <span className="toggle-custom-box"></span>
                    List as an Auction
                  </label>
                  <p className="toggle-help-text">Auction products will be approved to join a dedicated room.</p>
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

            {currentCategoryAttributes.length > 0 && (
              <div className="form-card">
                <h2>Specifications (Category Attributes)</h2>
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
            <div className="form-card">
              <h2>Product Images *</h2>
              <div className="image-upload-wrapper">
                <label className="image-upload-btn">
                  <span className="material-symbols-outlined">cloud_upload</span>
                  Upload Image
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
                        <span>Primary</span>
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
                {!isEdit ? 'Submit Product' : 'Save Changes'}
              </button>
              
              <button type="button" className="btn-cancel-product" onClick={() => navigate('/seller-dashboard/products')}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
