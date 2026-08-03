import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import categoryService from '../../../services/categoryService';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/Category.css';

export default function Category() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
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
  const [statusConfirmModal, setStatusConfirmModal] = useState({
    open: false,
    category: null,
    actionType: '',
    message: ''
  });

  const toggleTreeNode = (catId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [catId]: prev[catId] === undefined ? false : !prev[catId],
    }));
  };

  const categoryStats = useMemo(() => {
    const total = categories.length;
    const root = categories.filter((c) => !c.parentId).length;
    const child = categories.filter((c) => !!c.parentId).length;
    const totalAttrs = categories.reduce(
      (sum, c) => sum + (c.attributes?.filter((a) => !a.isDeleted).length || 0),
      0
    );
    return { total, root, child, totalAttrs };
  }, [categories]);

  const categoryTree = useMemo(() => {
    const map = {};
    const roots = [];

    categories.forEach((c) => {
      map[c.categoryId] = { ...c, children: [] };
    });

    categories.forEach((c) => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].children.push(map[c.categoryId]);
      } else {
        roots.push(map[c.categoryId]);
      }
    });

    return roots;
  }, [categories]);

  const renderActionButtons = (cat) => (
    <div className="cat-actions-cell" onClick={(e) => e.stopPropagation()}>
      <span className={`badge ${cat.status === 'Active' ? 'badge-success' : cat.status === 'Pending' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px', marginRight: '2px' }}>
        {formatStatus(cat.status)}
      </span>
      <button
        type="button"
        className="cat-tbl-btn view"
        onClick={() => openCategoryDetail(cat)}
        title={t('admin.categories.view_detail')}
      >
        <span className="material-symbols-outlined">visibility</span>
        <span>{t('admin.categories.view_short')}</span>
      </button>
      <button
        type="button"
        className="cat-tbl-btn edit"
        onClick={() => handleOpenEditModal(cat)}
        title={t('admin.categories.edit_category')}
      >
        <span className="material-symbols-outlined">edit</span>
        <span>{t('admin.categories.edit_short')}</span>
      </button>
      {cat.status === 'Pending' ? (
        <>
          <button 
            type="button"
            className="cat-tbl-btn toggle-on"
            onClick={() => promptApproveCategory(cat)}
            title={t('admin.categories.approve')}
          >
            <span className="material-symbols-outlined">check_circle</span>
            <span>{t('admin.categories.approve_short')}</span>
          </button>
          <button 
            type="button"
            className="cat-tbl-btn toggle-off"
            onClick={() => promptRejectCategory(cat)}
            title={t('admin.categories.reject')}
          >
            <span className="material-symbols-outlined">cancel</span>
            <span>{t('admin.categories.reject_short')}</span>
          </button>
        </>
      ) : (
        <button 
          type="button"
          className={`cat-tbl-btn ${cat.status === 'Active' ? 'toggle-off' : 'toggle-on'}`}
          onClick={() => promptToggleStatus(cat)}
          title={cat.status === 'Active' ? t('admin.categories.deactivate') : t('admin.categories.restore')}
        >
          <span className="material-symbols-outlined">
            {cat.status === 'Active' ? 'do_not_disturb_on' : 'check_circle'}
          </span>
          <span>{cat.status === 'Active' ? t('admin.categories.deactivate_short') : t('admin.categories.restore_short')}</span>
        </button>
      )}
    </div>
  );

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
  const [editingCategory, setEditingCategory] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailCategory, setDetailCategory] = useState(null);

  const openCategoryDetail = (cat) => {
    setDetailCategory(cat);
    setShowDetailModal(true);
  };

  const closeCategoryDetail = () => {
    setShowDetailModal(false);
    setDetailCategory(null);
  };

  const formatStatus = (st) => {
    if (!st || st === 'All') return t('admin.categories.status_all');
    if (st === 'Active') return t('admin.categories.status_active');
    if (st === 'Pending') return t('admin.categories.status_pending');
    if (st === 'Inactive') return t('admin.categories.status_inactive');
    return st;
  };
  
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

  const getApiErrorMessage = (err, fallbackKey) => {
    const data = err?.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data?.message && typeof data.message === 'string') return data.message;
    if (data?.detail && typeof data.detail === 'string') return data.detail;
    if (data?.title && typeof data.title === 'string') return data.title;
    return t(fallbackKey);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(t('admin.categories.msg_uploading_img'), 'info');
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
        showToast(t('admin.categories.msg_img_success'), 'success');
      } else {
        showToast(t('admin.categories.msg_img_warning'), 'warning');
      }
    } catch (err) {
      showToast(getApiErrorMessage(err, 'admin.categories.msg_img_error'), 'error');
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
      showToast(t('admin.categories.msg_load_error'), 'error');
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setSelectedImageFile(null);
    setImagePreview('');
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingCategory(null);
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
    setEditingCategory(category);
    setSelectedCategory(category);
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
      showToast(t('admin.categories.msg_name_required'), 'warning');
      return;
    }

    // Validate attributes
    for (let attr of attributes) {
      if (!attr.name.trim()) {
        showToast(t('admin.categories.msg_attr_name_required'), 'warning');
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
      const targetCatId = modalMode === 'create' ? null : (editingCategory?.categoryId || selectedCategory?.categoryId);

      if (modalMode === 'create') {
        showToast(t('admin.categories.msg_creating'), 'info');
        savedCategory = await categoryService.create(payload);
        showToast(t('admin.categories.msg_create_success'), 'success');
      } else {
        showToast(t('admin.categories.msg_updating'), 'info');
        savedCategory = await categoryService.update(targetCatId, payload);
        showToast(t('admin.categories.msg_update_success'), 'success');
      }

      if (selectedImageFile && (savedCategory || modalMode === 'edit')) {
        const categoryIdToUpload = modalMode === 'create' ? savedCategory.categoryId : targetCatId;
        showToast(t('admin.categories.msg_uploading_img'), 'info');
        const imgRes = await categoryService.uploadImage(categoryIdToUpload, selectedImageFile);
        if (imgRes?.imageUrl && modalMode === 'edit') {
          setSelectedCategory(prev => ({ ...prev, imageUrl: imgRes.imageUrl }));
        }
      }

      handleCloseModal();
      await fetchCategories();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'admin.categories.msg_save_error'), 'error');
    }
  };

  const promptToggleStatus = (category) => {
    const isActive = category.status === 'Active';
    const actionType = isActive ? 'deactivate' : 'restore';
    const rawMsg = isActive
      ? t('admin.categories.confirm_deactivate_msg')
      : t('admin.categories.confirm_restore_msg');
    const message = rawMsg.replace('{{name}}', category.name);

    setStatusConfirmModal({
      open: true,
      category,
      actionType,
      message
    });
  };

  const promptApproveCategory = (category) => {
    const rawMsg = t('admin.categories.confirm_approve_msg');
    const message = rawMsg.replace('{{name}}', category.name);

    setStatusConfirmModal({
      open: true,
      category,
      actionType: 'approve',
      message
    });
  };

  const promptRejectCategory = (category) => {
    const rawMsg = t('admin.categories.confirm_reject_msg');
    const message = rawMsg.replace('{{name}}', category.name);

    setStatusConfirmModal({
      open: true,
      category,
      actionType: 'reject',
      message
    });
  };

  const executeStatusChange = async () => {
    if (!statusConfirmModal.category) return;
    const { category, actionType } = statusConfirmModal;

    try {
      if (actionType === 'deactivate' || actionType === 'reject') {
        showToast(actionType === 'reject' ? t('admin.categories.msg_rejecting') : t('admin.categories.msg_deactivating'), 'info');
        await categoryService.inactive(category.categoryId);
        showToast(actionType === 'reject' ? t('admin.categories.msg_reject_success') : t('admin.categories.msg_deactivate_success'), 'success');
      } else {
        showToast(actionType === 'approve' ? t('admin.categories.msg_approving') : t('admin.categories.msg_restoring'), 'info');
        await categoryService.restore(category.categoryId);
        showToast(actionType === 'approve' ? t('admin.categories.msg_approve_success') : t('admin.categories.msg_restore_success'), 'success');
      }
      await fetchCategories();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'admin.categories.msg_status_error'), 'error');
    } finally {
      setStatusConfirmModal({ open: false, category: null, actionType: '', message: '' });
    }
  };

  return (
    <div className="category-page-wrapper container animate-fade-in">
      <div className="category-header-section">
        <div>
          <h1 className="category-headline">{t('admin.categories.hero_title')}</h1>
          <p className="category-subtitle">
            {t('admin.categories.hero_sub')}
          </p>
        </div>
        {isAdminView && (
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <span className="material-symbols-outlined">add_circle</span>
            {t('admin.categories.add_category')}
          </button>
        )}
      </div>

      {isAdminView && (
        <div className="cat-stats-grid">
          <div className="cat-stat-card">
            <div className="cat-stat-icon icon-red">
              <span className="material-symbols-outlined">category</span>
            </div>
            <div className="cat-stat-info">
              <span>{t('admin.categories.stat_total_cat')}</span>
              <h3>{categoryStats.total}</h3>
            </div>
          </div>

          <div className="cat-stat-card">
            <div className="cat-stat-icon icon-teal">
              <span className="material-symbols-outlined">account_tree</span>
            </div>
            <div className="cat-stat-info">
              <span>{t('admin.categories.stat_root_cat')}</span>
              <h3>{categoryStats.root}</h3>
            </div>
          </div>

          <div className="cat-stat-card">
            <div className="cat-stat-icon icon-blue">
              <span className="material-symbols-outlined">subdirectory_arrow_right</span>
            </div>
            <div className="cat-stat-info">
              <span>{t('admin.categories.stat_child_cat')}</span>
              <h3>{categoryStats.child}</h3>
            </div>
          </div>

          <div className="cat-stat-card">
            <div className="cat-stat-icon icon-amber">
              <span className="material-symbols-outlined">tune</span>
            </div>
            <div className="cat-stat-info">
              <span>{t('admin.categories.stat_total_attr')}</span>
              <h3>{categoryStats.totalAttrs}</h3>
            </div>
          </div>
        </div>
      )}

      <div className={`category-grid ${isAdminView ? 'admin-full-width' : ''}`}>
        <div className="category-card">
          <div className="search-filter-box">
            <input 
              type="text" 
              className="category-search-input" 
              placeholder={t('admin.categories.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isAdminView && (
            <div className="admin-filter-toolbar">
              <div className="filter-group-status">
                <span className="filter-toolbar-label">{t('common.status')}:</span>
                <div className="status-btn-group">
                  {['All', 'Active', 'Pending', 'Inactive'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`status-filter-btn ${statusFilter === status ? 'active' : ''}`}
                      onClick={() => setStatusFilter(status)}
                    >
                      {formatStatus(status)}
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
                  <span>{t('admin.categories.root_only')}</span>
                </label>
                <div className="sort-selector-wrapper">
                  <span className="material-symbols-outlined sort-icon">sort</span>
                  <select
                    className="admin-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="NameAsc">{t('admin.categories.sort_name_asc')}</option>
                    <option value="NameDesc">{t('admin.categories.sort_name_desc')}</option>
                    <option value="Newest">{t('admin.categories.sort_newest')}</option>
                    <option value="Oldest">{t('admin.categories.sort_oldest')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span className="btn-spinner"></span>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>{t('common.loading')}</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>{t('common.no_data')}</p>
          ) : isAdminView ? (
            <div className="category-diagram-canvas">
              <div className="diagram-top-bar">
                <div className="diagram-legend">
                  <span className="legend-item"><span className="legend-dot root-dot"></span> {t('admin.categories.stat_root_cat')}</span>
                  <span className="legend-item"><span className="legend-dot child-dot"></span> {t('admin.categories.stat_child_cat')}</span>
                  <span className="legend-item"><span className="legend-dot attr-dot"></span> {t('admin.categories.stat_total_attr')}</span>
                </div>
              </div>

              <div className="diagram-nodes-grid">
                {categoryTree.map((rootCat) => {
                  const childCount = rootCat.children?.length || 0;
                  const validAttrs = rootCat.attributes?.filter((a) => !a.isDeleted) || [];

                  return (
                    <div 
                      key={rootCat.categoryId} 
                      className="diagram-node-card root-card"
                      onClick={() => openCategoryDetail(rootCat)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="diagram-node-header">
                        <div className="diagram-node-identity">
                          {rootCat.imageUrl ? (
                            <img src={rootCat.imageUrl} alt={rootCat.name} className="cat-avatar-img" />
                          ) : (
                            <div className="cat-avatar-placeholder">
                              <span className="material-symbols-outlined">folder</span>
                            </div>
                          )}
                          <div className="cat-name-block">
                            <strong>{rootCat.name}</strong>
                            <span>ID: {rootCat.categoryId}</span>
                          </div>
                        </div>

                        {renderActionButtons(rootCat)}
                      </div>

                      <div className="diagram-node-body">
                        {validAttrs.length > 0 && (
                          <div className="diagram-attrs-block">
                            <div className="diagram-attrs-title">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tune</span>
                              <span>{t('admin.categories.specifications')} ({validAttrs.length})</span>
                            </div>
                            <div className="diagram-attr-chips">
                              {validAttrs.map((attr) => (
                                <span key={attr.attributeId} className="diagram-attr-chip">
                                  <span>{attr.name}</span>
                                  <span className="attr-type-badge">{attr.dataType}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {childCount > 0 && (
                          <div className="diagram-children-branch">
                            <div className="diagram-attrs-title" style={{ color: '#0f766e', marginBottom: '10px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>subdirectory_arrow_right</span>
                              <span>{t('admin.categories.stat_child_cat')} ({childCount})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {rootCat.children.map((child) => {
                                const childAttrs = child.attributes?.filter((a) => !a.isDeleted) || [];
                                return (
                                  <div 
                                    key={child.categoryId} 
                                    className="diagram-node-card child-card"
                                    onClick={(e) => { e.stopPropagation(); openCategoryDetail(child); }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div className="diagram-node-header" style={{ padding: '12px 14px' }}>
                                      <div className="diagram-node-identity">
                                        {child.imageUrl ? (
                                          <img src={child.imageUrl} alt={child.name} className="cat-avatar-img" style={{ width: '32px', height: '32px' }} />
                                        ) : (
                                          <div className="cat-avatar-placeholder" style={{ width: '32px', height: '32px' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>category</span>
                                          </div>
                                        )}
                                        <div className="cat-name-block">
                                          <strong style={{ fontSize: '13px' }}>{child.name}</strong>
                                          <span>ID: {child.categoryId}</span>
                                        </div>
                                      </div>

                                      {renderActionButtons(child)}
                                    </div>

                                    {childAttrs.length > 0 && (
                                      <div className="diagram-node-body" style={{ padding: '0 14px 12px' }}>
                                        <div className="diagram-attr-chips">
                                          {childAttrs.map((attr) => (
                                            <span key={attr.attributeId} className="diagram-attr-chip" style={{ fontSize: '10.5px' }}>
                                              <span>{attr.name}</span>
                                              <span className="attr-type-badge">{attr.dataType}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Detail & Attributes Modal */}
      {showDetailModal && detailCategory && createPortal(
        <div className="cat-detail-modal-overlay" onClick={closeCategoryDetail}>
          <div className="cat-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cat-detail-modal-header">
              <div className="cat-detail-header-left">
                {detailCategory.imageUrl ? (
                  <img src={detailCategory.imageUrl} alt={detailCategory.name} className="cat-detail-header-img" />
                ) : (
                  <div className="cat-avatar-placeholder">
                    <span className="material-symbols-outlined">category</span>
                  </div>
                )}
                <div className="cat-detail-header-title">
                  <span className={`badge ${
                    detailCategory.status === 'Active' ? 'badge-success' : 
                    detailCategory.status === 'Pending' ? 'badge-warning' : 'badge-danger'
                  }`} style={{ marginBottom: '4px', fontSize: '11px' }}>
                    {formatStatus(detailCategory.status)}
                  </span>
                  <h3>{detailCategory.name}</h3>
                </div>
              </div>
              <button type="button" className="admin-confirm-close" onClick={closeCategoryDetail}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="cat-detail-modal-body">
              <div className="cat-detail-meta-grid">
                <div className="cat-detail-meta-item">
                  <span>{t('admin.categories.cat_id')}</span>
                  <strong>{detailCategory.categoryId}</strong>
                </div>
                <div className="cat-detail-meta-item">
                  <span>{t('admin.categories.parent_id')}</span>
                  <strong>{detailCategory.parentId || t('admin.categories.root_category')}</strong>
                </div>
                <div className="cat-detail-meta-item">
                  <span>{t('admin.categories.created_at')}</span>
                  <strong>{detailCategory.createdAt ? new Date(detailCategory.createdAt).toLocaleString() : 'N/A'}</strong>
                </div>
                <div className="cat-detail-meta-item">
                  <span>{t('admin.categories.updated_at')}</span>
                  <strong>{detailCategory.updatedAt ? new Date(detailCategory.updatedAt).toLocaleString() : 'N/A'}</strong>
                </div>
              </div>

              <div className="description-section">
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>{t('admin.categories.description')}</h4>
                <p className="description-text" style={{ fontSize: '13.5px', color: '#475569', margin: 0, lineHeight: 1.6 }}>{detailCategory.description || t('admin.categories.no_description')}</p>
              </div>

              <div className="attributes-section">
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>{t('admin.categories.specifications')}</h4>
                {!detailCategory.attributes || detailCategory.attributes.filter(a => !a.isDeleted).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>{t('admin.categories.no_attributes')}</p>
                ) : (
                  <div className="attributes-table-wrapper" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <table className="attributes-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>{t('admin.categories.th_order')}</th>
                          <th>{t('admin.categories.th_attr_id')}</th>
                          <th>{t('admin.categories.th_name')}</th>
                          <th>{t('admin.categories.th_data_type')}</th>
                          <th>{t('admin.categories.th_required')}</th>
                          <th>{t('admin.categories.th_unit')}</th>
                          <th>{t('admin.categories.th_validation')}</th>
                          <th>{t('admin.categories.th_ui_controls')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(detailCategory.attributes || [])]
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
                              <td>{attr.isRequired ? t('admin.categories.attr_required_yes') : t('admin.categories.attr_required_no')}</td>
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
            </div>

            <div className="cat-detail-modal-footer">
              <button type="button" className="cat-tbl-btn edit" onClick={() => { closeCategoryDetail(); handleOpenEditModal(detailCategory); }}>
                <span className="material-symbols-outlined">edit</span>
                <span>{t('admin.categories.edit_category')}</span>
              </button>
              <button type="button" className="cat-tbl-btn view" onClick={closeCategoryDetail}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && createPortal(
        <div className="modal-overlay animate-fade-in" onClick={handleCloseModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? t('admin.categories.add_category') : t('admin.categories.edit_category')}</h3>
              <button className="modal-close-btn" onClick={handleCloseModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('admin.categories.category_name')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('admin.categories.category_image')}</label>
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
                        <span>{t('admin.categories.select_image')}</span>
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
                  <label className="form-label">{t('admin.categories.col_parent')}</label>
                  <select 
                    className="form-input" 
                    value={parentId} 
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">{t('admin.categories.root_category')}</option>
                    {categories
                      .filter(c => modalMode === 'create' || c.categoryId !== selectedCategory?.categoryId) // prevent self-referencing loop
                      .map(c => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.name} ({c.categoryId})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('admin.categories.description')}</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('admin.categories.specifications')}</span>
                    <button type="button" className="add-attr-trigger" onClick={handleAddAttributeRow}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                      {t('admin.categories.add_attribute')}
                    </button>
                  </label>

                  <div className="attributes-creator-widget">
                    {attributes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                        {t('admin.categories.no_attributes')}
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
                              placeholder={t('admin.categories.th_name')} 
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
                              <label>{t('admin.categories.th_unit')}</label>
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
                                <span>{t('admin.categories.th_required')}</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isFilterable || false}
                                  onChange={(e) => handleAttributeChange(idx, 'isFilterable', e.target.checked)}
                                />
                                <span>{t('admin.categories.attr_filterable')}</span>
                              </label>
                              
                              <label className="checkbox-label">
                                <input 
                                  type="checkbox" 
                                  checked={attr.isSearchable || false}
                                  onChange={(e) => handleAttributeChange(idx, 'isSearchable', e.target.checked)}
                                />
                                <span>{t('admin.categories.attr_searchable')}</span>
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
                            {t('admin.categories.restore')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('admin.categories.save_changes')}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Status Changes */}
      {statusConfirmModal.open && createPortal(
        <div className="cat-detail-modal-overlay" onClick={() => setStatusConfirmModal({ open: false, category: null, actionType: '', message: '' })}>
          <div className="cat-detail-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cat-detail-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ color: statusConfirmModal.actionType === 'deactivate' || statusConfirmModal.actionType === 'reject' ? '#dc2626' : '#16a34a', fontSize: '24px' }}>
                  {statusConfirmModal.actionType === 'deactivate' || statusConfirmModal.actionType === 'reject' ? 'warning' : 'check_circle'}
                </span>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                  {t('admin.categories.confirm_title')}
                </h3>
              </div>
              <button type="button" className="cat-detail-close-btn" onClick={() => setStatusConfirmModal({ open: false, category: null, actionType: '', message: '' })}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '20px', fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
              {statusConfirmModal.message}
            </div>

            <div className="cat-detail-modal-footer" style={{ padding: '12px 20px', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStatusConfirmModal({ open: false, category: null, actionType: '', message: '' })}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: statusConfirmModal.actionType === 'deactivate' || statusConfirmModal.actionType === 'reject' ? '#dc2626' : '#16a34a',
                  borderColor: statusConfirmModal.actionType === 'deactivate' || statusConfirmModal.actionType === 'reject' ? '#dc2626' : '#16a34a',
                  color: '#ffffff'
                }}
                onClick={executeStatusChange}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
