import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import categoryService from '../../../services/categoryService';
import '../../../styles/Category.css';

export default function Category() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const isAdmin = user?.roles?.includes('Admin') || false;
  const isAdminView = isAdmin && location.pathname.startsWith('/admin');

  const [categories, setCategories] = useState([]);
  const [hierarchicalCategories, setHierarchicalCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Admin OData filtering & sorting states
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Inactive'
  const [isRootOnly, setIsRootOnly] = useState(false);
  const [sortBy, setSortBy] = useState('NameAsc'); // 'NameAsc' | 'NameDesc' | 'Newest' | 'Oldest'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [attributes, setAttributes] = useState([]); // Array of { attributeId, name, dataType, isRequired }
  const [deletedAttributes, setDeletedAttributes] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const modalImageInputRef = useRef(null);

  const handleModalImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    setImagePreview('');
    if (modalImageInputRef.current) {
      modalImageInputRef.current.value = '';
    }
  };

  const imageInputRef = useRef(null);

  const handleChooseImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading category image...', 'info');
      const res = await categoryService.uploadImage(selectedCategory.categoryId, file);
      if (res?.imageUrl) {
        setCategories((prev) =>
          prev.map((c) =>
            c.categoryId === selectedCategory.categoryId
              ? { ...c, imageUrl: res.imageUrl }
              : c
          )
        );
        setSelectedCategory((prev) => ({ ...prev, imageUrl: res.imageUrl }));
        showToast('Category image updated successfully.', 'success');
      } else {
        showToast('Upload succeeded but no image URL was returned.', 'warning');
      }
    } catch (err) {
      showToast(err?.response?.data || 'Failed to upload category image.', 'error');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [debouncedSearchTerm, statusFilter, isRootOnly, sortBy, isAdminView]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      
      const queryParams = [];
      const filterConditions = [];

      // 1. Search term filter
      if (debouncedSearchTerm.trim()) {
        filterConditions.push(`contains(tolower(Name), '${debouncedSearchTerm.toLowerCase().replace(/'/g, "''")}')`);
      }

      // 2. View-specific filters
      if (isAdminView) {
        // Status filter
        if (statusFilter !== 'All') {
          filterConditions.push(`Status eq '${statusFilter}'`);
        }
        // Hierarchy filter (Root only)
        if (isRootOnly) {
          filterConditions.push(`ParentId eq null`);
        }
      } else {
        // Buyer view only sees active categories
        filterConditions.push("Status eq 'Active'");
      }

      if (filterConditions.length > 0) {
        queryParams.push(`$filter=${filterConditions.join(' and ')}`);
      }

      // 3. Sorting
      let orderByStr = 'Name asc';
      if (isAdminView) {
        switch (sortBy) {
          case 'NameDesc':
            orderByStr = 'Name desc';
            break;
          case 'Newest':
            orderByStr = 'CreatedAt desc';
            break;
          case 'Oldest':
            orderByStr = 'CreatedAt asc';
            break;
          case 'NameAsc':
          default:
            orderByStr = 'Name asc';
            break;
        }
      }
      queryParams.push(`$orderby=${orderByStr}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      const data = isAdminView 
        ? await categoryService.getAll(queryString) 
        : await categoryService.getAllActive(queryString);
      
      const categoriesArray = Array.isArray(data) ? data : (data && Array.isArray(data.value) ? data.value : []);
      setCategories(categoriesArray);
      
      if (categoriesArray && categoriesArray.length > 0) {
        const prevSelected = selectedCategory 
          ? categoriesArray.find(c => c.categoryId === selectedCategory.categoryId)
          : categoriesArray[0];
        setSelectedCategory(prevSelected || categoriesArray[0]);
      } else {
        setSelectedCategory(null);
      }
    } catch (err) {
      showToast('Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (categories.length > 0) {
      // Build hierarchical structure
      const map = {};
      const roots = [];

      categories.forEach(c => {
        map[c.categoryId] = { ...c, children: [] };
      });

      categories.forEach(c => {
        if (c.parentId && map[c.parentId]) {
          map[c.parentId].children.push(map[c.categoryId]);
        } else {
          roots.push(map[c.categoryId]);
        }
      });

      const flattened = [];
      const traverse = (node, depth) => {
        flattened.push({ ...node, depth });
        node.children.forEach(child => traverse(child, depth + 1));
      };

      roots.forEach(root => traverse(root, 0));

      setHierarchicalCategories(flattened);
    } else {
      setHierarchicalCategories([]);
    }
  }, [categories]);

  const filteredCategories = hierarchicalCategories;

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setName('');
    setDescription('');
    setParentId('');
    setAttributes([]);
    setDeletedAttributes([]);
    setSelectedImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category) => {
    setModalMode('edit');
    setName(category.name || '');
    setDescription(category.description || '');
    setParentId(category.parentId || '');
    
    const allAttrs = category.attributes || [];
    
    // Mapping existing attributes. Note: exclude attributes with IsDeleted === true
    const activeAttrs = allAttrs
      .filter(attr => !attr.isDeleted)
      .map(attr => ({
        attributeId: attr.attributeId,
        name: attr.name || '',
        dataType: attr.dataType || 'String',
        isRequired: attr.isRequired || false,
        minValue: attr.minValue !== undefined && attr.minValue !== null ? attr.minValue : null,
        maxValue: attr.maxValue !== undefined && attr.maxValue !== null ? attr.maxValue : null,
        unit: attr.unit || '',
        displayOrder: attr.displayOrder || 0,
        isFilterable: attr.isFilterable || false,
        isSearchable: attr.isSearchable || false
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
      
    // Mapping deleted attributes to show in restoration panel
    const inactiveAttrs = allAttrs
      .filter(attr => attr.isDeleted)
      .map(attr => ({
        attributeId: attr.attributeId,
        name: attr.name || '',
        dataType: attr.dataType || 'String',
        isRequired: attr.isRequired || false,
        minValue: attr.minValue !== undefined && attr.minValue !== null ? attr.minValue : null,
        maxValue: attr.maxValue !== undefined && attr.maxValue !== null ? attr.maxValue : null,
        unit: attr.unit || '',
        displayOrder: attr.displayOrder || 0,
        isFilterable: attr.isFilterable || false,
        isSearchable: attr.isSearchable || false
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);

    setAttributes(activeAttrs);
    setDeletedAttributes(inactiveAttrs);
    setSelectedImageFile(null);
    setImagePreview(category.imageUrl || '');
    setIsModalOpen(true);
  };

  const handleAddAttributeRow = () => {
    setAttributes([...attributes, { 
      attributeId: '', 
      name: '', 
      dataType: 'String', 
      isRequired: false,
      minValue: null,
      maxValue: null,
      unit: '',
      displayOrder: attributes.length + 1,
      isFilterable: false,
      isSearchable: false
    }]);
  };

  const handleAttributeChange = (index, field, value) => {
    const updated = [...attributes];
    updated[index][field] = value;
    setAttributes(updated);
  };

  const handleRemoveAttributeRow = (index) => {
    const updated = attributes.filter((_, i) => i !== index);
    setAttributes(updated);
  };

  const handleRestoreAttribute = (index) => {
    const attrToRestore = deletedAttributes[index];
    setDeletedAttributes(prev => prev.filter((_, i) => i !== index));
    setAttributes(prev => [...prev, attrToRestore]);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add small visual delay or effect
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...attributes];
    const draggedItem = updated[draggedIndex];
    
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setAttributes(updated);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedIndex(null);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required.', 'warning');
      return;
    }

    // Validate attributes
    for (let attr of attributes) {
      if (!attr.name.trim()) {
        showToast('All attribute names must be filled out.', 'warning');
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      parentId: parentId || null,
      attributes: attributes.map((a, index) => ({
        attributeId: a.attributeId || null,
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
      let savedCategory = null;
      if (modalMode === 'create') {
        showToast('Creating category...', 'info');
        savedCategory = await categoryService.create(payload);
        showToast('Category created successfully.', 'success');
      } else {
        showToast('Updating category...', 'info');
        savedCategory = await categoryService.update(selectedCategory.categoryId, payload);
        showToast('Category updated successfully.', 'success');
      }

      if (selectedImageFile && (savedCategory || modalMode === 'edit')) {
        const categoryIdToUpload = modalMode === 'create' ? savedCategory.categoryId : selectedCategory.categoryId;
        showToast('Uploading category image...', 'info');
        const imgRes = await categoryService.uploadImage(categoryIdToUpload, selectedImageFile);
        if (imgRes?.imageUrl && modalMode === 'edit') {
          setSelectedCategory(prev => ({ ...prev, imageUrl: imgRes.imageUrl }));
        }
      }

      setIsModalOpen(false);
      setSelectedImageFile(null);
      setImagePreview('');
      await fetchCategories();
    } catch (err) {
      const errMsg = err?.response?.data || 'Failed to save category.';
      showToast(errMsg, 'error');
    }
  };

  const handleToggleStatus = async (category) => {
    const isActive = category.status === 'Active';
    try {
      showToast(isActive ? 'Deactivating category...' : 'Restoring category...', 'info');
      if (isActive) {
        await categoryService.inactive(category.categoryId);
        showToast('Category deactivated successfully.', 'success');
      } else {
        await categoryService.restore(category.categoryId);
        showToast('Category restored successfully.', 'success');
      }
      await fetchCategories();
    } catch (err) {
      showToast('Failed to update category status.', 'error');
    }
  };

  const handleApproveCategory = async (category) => {
    try {
      showToast('Approving category...', 'info');
      await categoryService.restore(category.categoryId);
      showToast('Category approved and active now.', 'success');
      await fetchCategories();
    } catch (err) {
      showToast('Failed to approve category.', 'error');
    }
  };

  const handleRejectCategory = async (category) => {
    try {
      showToast('Rejecting category...', 'info');
      await categoryService.inactive(category.categoryId);
      showToast('Category rejected (marked as Inactive).', 'success');
      await fetchCategories();
    } catch (err) {
      showToast('Failed to reject category.', 'error');
    }
  };

  return (
    <div className="category-page-wrapper container animate-fade-in">
      <div className="category-header-section">
        <div>
          <h1 className="category-headline">Categories</h1>
          <p className="category-subtitle">
            {isAdminView 
              ? 'Manage product categories and custom specification attributes (Admin Mode)' 
              : 'Browse and inspect categories and their specification attributes'
            }
          </p>
        </div>
        {isAdminView && (
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <span className="material-symbols-outlined">add_circle</span>
            Add Category
          </button>
        )}
      </div>

      <div className="category-grid">
        {/* Left Column: Categories List */}
        <div className="category-card">
          <div className="search-filter-box">
            <input 
              type="text" 
              className="category-search-input" 
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isAdminView && (
            <div className="admin-filter-toolbar">
              <div className="filter-group-status">
                <span className="filter-toolbar-label">Status:</span>
                <div className="status-btn-group">
                  {['All', 'Active', 'Pending', 'Inactive'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`status-filter-btn ${statusFilter === status ? 'active' : ''}`}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group-hierarchy-sort">
                <label className="root-only-label">
                  <input
                    type="checkbox"
                    checked={isRootOnly}
                    onChange={(e) => setIsRootOnly(e.target.checked)}
                  />
                  <span>Root only</span>
                </label>
                <div className="sort-selector-wrapper">
                  <span className="material-symbols-outlined sort-icon">sort</span>
                  <select
                    className="admin-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="NameAsc">Name A-Z</option>
                    <option value="NameDesc">Name Z-A</option>
                    <option value="Newest">Newest</option>
                    <option value="Oldest">Oldest</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span className="btn-spinner"></span>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading list...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No categories found.</p>
          ) : (
            <div className="category-list-container">
              <div className="category-list-group">
                {filteredCategories.map((cat) => (
                  <div 
                    key={cat.categoryId}
                    className={`category-item-row category-indent-${Math.min(cat.depth, 2)} ${selectedCategory?.categoryId === cat.categoryId ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <div className="category-item-info">
                      <span className={`status-indicator ${cat.status?.toLowerCase() === 'active' ? 'active' : 'inactive'}`}></span>
                      <span className="category-item-name">{cat.name}</span>
                    </div>
                    {isAdminView && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.categoryId}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Details Panel */}
        <div className="category-card glass-panel" style={{ minHeight: '400px' }}>
          {selectedCategory ? (
            <div>
              <div className="detail-header-card">
                <div className="detail-header-with-image">
                  <div className="category-image-container">
                    {selectedCategory.imageUrl ? (
                      <img src={selectedCategory.imageUrl} alt={selectedCategory.name} className="category-detail-img" />
                    ) : (
                      <div className="category-detail-img-placeholder">
                        <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>category</span>
                      </div>
                    )}
                    {isAdminView && (
                      <div className="category-image-overlay" onClick={handleChooseImage}>
                        <span className="material-symbols-outlined">photo_camera</span>
                        <span>Update Image</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                  <div className="detail-title-block">
                    {isAdminView && (
                      <span className={`badge ${
                        selectedCategory.status === 'Active' ? 'badge-success' : 
                        selectedCategory.status === 'Pending' ? 'badge-warning' : 'badge-danger'
                      }`} style={{ marginBottom: '8px' }}>
                        {selectedCategory.status}
                      </span>
                    )}
                    <h2>{selectedCategory.name}</h2>
                  </div>
                </div>
                {isAdminView && (
                  <div className="details-actions-bar" style={{ marginTop: 0 }}>
                    <button className="btn btn-outline" onClick={() => handleOpenEditModal(selectedCategory)}>
                      <span className="material-symbols-outlined">edit</span>
                      Edit
                    </button>
                    {selectedCategory.status === 'Pending' ? (
                      <>
                        <button 
                          className="btn btn-success"
                          onClick={() => handleApproveCategory(selectedCategory)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                          Approve
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={() => handleRejectCategory(selectedCategory)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                          Reject
                        </button>
                      </>
                    ) : (
                      <button 
                        className={`btn ${selectedCategory.status === 'Active' ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleToggleStatus(selectedCategory)}
                      >
                        <span className="material-symbols-outlined">
                          {selectedCategory.status === 'Active' ? 'do_not_disturb_on' : 'check_circle'}
                        </span>
                        {selectedCategory.status === 'Active' ? 'Deactivate' : 'Restore'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isAdminView && (
                <div className="detail-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Category ID</span>
                    <span className="meta-value">{selectedCategory.categoryId}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Parent ID</span>
                    <span className="meta-value">{selectedCategory.parentId || 'None (Root)'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Created At</span>
                    <span className="meta-value">{selectedCategory.createdAt ? new Date(selectedCategory.createdAt).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Updated At</span>
                    <span className="meta-value">{selectedCategory.updatedAt ? new Date(selectedCategory.updatedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              )}

              <div className="description-section">
                <h4>Description</h4>
                <p className="description-text">{selectedCategory.description || 'No description provided.'}</p>
              </div>

              {isAdminView && (
                <div className="attributes-section">
                  <h4>Specifications & Attributes</h4>
                  {!selectedCategory.attributes || selectedCategory.attributes.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No attributes specified for this category.</p>
                  ) : (
                    <div className="attributes-table-wrapper" style={{ overflowX: 'auto' }}>
                      <table className="attributes-table">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Attribute ID</th>
                            <th>Name</th>
                            <th>Data Type</th>
                            <th>Required</th>
                            <th>Unit</th>
                            <th>Validation (Min/Max)</th>
                            <th>UI Controls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(selectedCategory.attributes || [])]
                            .filter(attr => !attr.isDeleted)
                            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                            .map((attr) => (
                              <tr key={attr.attributeId}>
                                <td><strong>#{attr.displayOrder || '-'}</strong></td>
                                <td><code>{attr.attributeId}</code></td>
                                <td style={{ fontWeight: 600 }}>{attr.name}</td>
                                <td>
                                  <span className="badge badge-success" style={{ background: 'rgba(11, 148, 133, 0.08)', color: 'var(--accent)', border: 'none' }}>
                                    {attr.dataType}
                                  </span>
                                </td>
                                <td>{attr.isRequired ? 'Yes' : 'No'}</td>
                                <td>{attr.unit || '-'}</td>
                                <td>
                                  {attr.dataType === 'Number' && (attr.minValue !== null || attr.maxValue !== null) ? (
                                    <span style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                      {attr.minValue !== null && `Min: ${attr.minValue}`}
                                      {attr.minValue !== null && attr.maxValue !== null && <br />}
                                      {attr.maxValue !== null && `Max: ${attr.maxValue}`}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                    {attr.isFilterable && (
                                      <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px', width: 'fit-content' }}>
                                        Filterable
                                      </span>
                                    )}
                                    {attr.isSearchable && (
                                      <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: 'fit-content' }}>
                                        Searchable
                                      </span>
                                    )}
                                    {!attr.isFilterable && !attr.isSearchable && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection-card">
              <span className="material-symbols-outlined no-selection-icon">category</span>
              <h3>No Category Selected</h3>
              <p>Choose a category from the left pane to view details, attributes, and options.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? 'Add New Category' : 'Edit Category'}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category Image</label>
                  <div className="modal-category-image-wrapper">
                    {imagePreview ? (
                      <div className="modal-image-preview-container">
                        <img src={imagePreview} alt="Preview" className="modal-image-preview" />
                        <button type="button" className="remove-preview-btn" onClick={handleRemoveSelectedImage}>
                          <span className="material-symbols-outlined">cancel</span>
                        </button>
                      </div>
                    ) : (
                      <div className="modal-image-upload-trigger" onClick={() => modalImageInputRef.current?.click()}>
                        <span className="material-symbols-outlined">add_photo_alternate</span>
                        <span>Select Category Image</span>
                      </div>
                    )}
                    <input
                      ref={modalImageInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleModalImageChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Category</label>
                  <select 
                    className="form-input" 
                    value={parentId} 
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">None (Root Category)</option>
                    {categories
                      .filter(c => modalMode === 'create' || c.categoryId !== selectedCategory.categoryId) // prevent self-referencing loop
                      .map(c => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.name} ({c.categoryId})
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
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Specifications & Attributes</span>
                    <button type="button" className="add-attr-trigger" onClick={handleAddAttributeRow}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                      Add Attribute
                    </button>
                  </label>

                  <div className="attributes-creator-widget">
                    {attributes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                        No attributes configured. Click "Add Attribute" to add specifications.
                      </p>
                    ) : (
                      attributes.map((attr, idx) => (
                        <div 
                          key={idx} 
                          className={`attribute-card-item ${draggedIndex === idx ? 'dragging' : ''}`}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="attribute-card-header">
                            <div className="drag-handle" title="Drag to reorder">
                              <span className="material-symbols-outlined">drag_indicator</span>
                            </div>
                            <input 
                              type="text" 
                              className="form-input attr-name-input" 
                              placeholder="Attribute Name (e.g. Size)" 
                              value={attr.name}
                              onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                              required
                            />
                            <select 
                              className="form-input attr-type-select" 
                              value={attr.dataType}
                              onChange={(e) => handleAttributeChange(idx, 'dataType', e.target.value)}
                              disabled={!!attr.attributeId}
                            >
                              <option value="String">String</option>
                              <option value="Number">Number</option>
                              <option value="Boolean">Boolean</option>
                              <option value="DateTime">DateTime</option>
                            </select>
                            <button type="button" className="attr-action-btn" onClick={() => handleRemoveAttributeRow(idx)} title="Delete attribute">
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                          
                          <div className="attribute-card-settings">
                            <div className="settings-field">
                              <label>Unit</label>
                              <input 
                                type="text" 
                                className="form-input input-sm" 
                                placeholder="e.g. kg, GB, px" 
                                value={attr.unit || ''}
                                onChange={(e) => handleAttributeChange(idx, 'unit', e.target.value)}
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
                                    onChange={(e) => handleAttributeChange(idx, 'minValue', e.target.value === '' ? null : e.target.value)}
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
                                    onChange={(e) => handleAttributeChange(idx, 'maxValue', e.target.value === '' ? null : e.target.value)}
                                  />
                                </div>
                              </>
                            )}
                            
                            <div className="checkboxes-group">
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isRequired || false}
                                  onChange={(e) => handleAttributeChange(idx, 'isRequired', e.target.checked)}
                                />
                                <span>Required</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isFilterable || false}
                                  onChange={(e) => handleAttributeChange(idx, 'isFilterable', e.target.checked)}
                                />
                                <span>Filterable</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isSearchable || false}
                                  onChange={(e) => handleAttributeChange(idx, 'isSearchable', e.target.checked)}
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

                {deletedAttributes.length > 0 && (
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label className="form-label">Deleted Attributes (Click Restore to recover)</label>
                    <div className="deleted-attributes-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {deletedAttributes.map((attr, idx) => (
                        <div key={idx} className="attribute-card-item deleted-item" style={{ opacity: 0.7, border: '1px dashed #cbd5e1', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ textDecoration: 'line-through', marginRight: '8px' }}>{attr.name}</strong> 
                            <span className="badge badge-success" style={{ background: 'rgba(11, 148, 133, 0.08)', color: 'var(--accent)', border: 'none', fontSize: '11px', padding: '2px 6px' }}>{attr.dataType}</span>
                            {attr.unit && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>({attr.unit})</span>}
                          </div>
                          <button type="button" className="btn btn-outline" onClick={() => handleRestoreAttribute(idx)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', height: 'fit-content' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restore</span>
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
