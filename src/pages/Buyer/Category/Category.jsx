import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import categoryService from '../../../services/categoryService';
import '../../../styles/Category.css';

export default function Category() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.roles?.includes('Admin') || false;

  const [categories, setCategories] = useState([]);
  const [hierarchicalCategories, setHierarchicalCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [attributes, setAttributes] = useState([]); // Array of { attributeId, name, dataType, isRequired }

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      
      // Admin gets all categories (active & inactive) to manage. Regular users only get active categories via OData filter.
      const data = isAdmin 
        ? await categoryService.getAll() 
        : await categoryService.getAllActive();
      
      // Handle both raw array and OData response formats
      const categoriesArray = Array.isArray(data) ? data : (data && Array.isArray(data.value) ? data.value : []);
      setCategories(categoriesArray);
      
      // Select the first category by default if available
      if (categoriesArray && categoriesArray.length > 0) {
        // Find if there was a previously selected category to maintain selection
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
        node.children.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        node.children.forEach(child => traverse(child, depth + 1));
      };

      roots.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      roots.forEach(root => traverse(root, 0));

      setHierarchicalCategories(flattened);
    } else {
      setHierarchicalCategories([]);
    }
  }, [categories]);

  const filteredCategories = hierarchicalCategories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setName('');
    setDescription('');
    setParentId('');
    setAttributes([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category) => {
    setModalMode('edit');
    setName(category.name || '');
    setDescription(category.description || '');
    setParentId(category.parentId || '');
    // Mapping existing attributes. Note: exclude attributes with IsDeleted === true
    const activeAttrs = (category.attributes || [])
      .map(attr => ({
        attributeId: attr.attributeId,
        name: attr.name || '',
        dataType: attr.dataType || 'String',
        isRequired: attr.isRequired || false
      }));
    setAttributes(activeAttrs);
    setIsModalOpen(true);
  };

  const handleAddAttributeRow = () => {
    setAttributes([...attributes, { attributeId: '', name: '', dataType: 'String', isRequired: false }]);
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
      attributes: attributes.map(a => ({
        attributeId: a.attributeId || null,
        name: a.name.trim(),
        dataType: a.dataType,
        isRequired: a.isRequired
      }))
    };

    try {
      if (modalMode === 'create') {
        showToast('Creating category...', 'info');
        await categoryService.create(payload);
        showToast('Category created successfully.', 'success');
      } else {
        showToast('Updating category...', 'info');
        await categoryService.update(selectedCategory.categoryId, payload);
        showToast('Category updated successfully.', 'success');
      }
      setIsModalOpen(false);
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

  return (
    <div className="category-page-wrapper container animate-fade-in">
      <div className="category-header-section">
        <div>
          <h1 className="category-headline">Categories</h1>
          <p className="category-subtitle">
            {isAdmin 
              ? 'Manage product categories and custom specification attributes (Admin Mode)' 
              : 'Browse and inspect categories and their specification attributes'
            }
          </p>
        </div>
        {isAdmin && (
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
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.categoryId}</span>
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
                <div className="detail-title-block">
                  <span className={`badge ${selectedCategory.status === 'Active' ? 'badge-success' : 'badge-danger'}`} style={{ marginBottom: '8px' }}>
                    {selectedCategory.status}
                  </span>
                  <h2>{selectedCategory.name}</h2>
                </div>
                {isAdmin && (
                  <div className="details-actions-bar" style={{ marginTop: 0 }}>
                    <button className="btn btn-outline" onClick={() => handleOpenEditModal(selectedCategory)}>
                      <span className="material-symbols-outlined">edit</span>
                      Edit
                    </button>
                    <button 
                      className={`btn ${selectedCategory.status === 'Active' ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => handleToggleStatus(selectedCategory)}
                    >
                      <span className="material-symbols-outlined">
                        {selectedCategory.status === 'Active' ? 'do_not_disturb_on' : 'check_circle'}
                      </span>
                      {selectedCategory.status === 'Active' ? 'Deactivate' : 'Restore'}
                    </button>
                  </div>
                )}
              </div>

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

              <div className="description-section">
                <h4>Description</h4>
                <p className="description-text">{selectedCategory.description || 'No description provided.'}</p>
              </div>

              <div className="attributes-section">
                <h4>Specifications & Attributes</h4>
                {!selectedCategory.attributes || selectedCategory.attributes.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No attributes specified for this category.</p>
                ) : (
                  <div className="attributes-table-wrapper">
                    <table className="attributes-table">
                      <thead>
                        <tr>
                          <th>Attribute ID</th>
                          <th>Name</th>
                          <th>Data Type</th>
                          <th>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCategory.attributes.map((attr) => (
                          <tr key={attr.attributeId}>
                            <td><code>{attr.attributeId}</code></td>
                            <td style={{ fontWeight: 600 }}>{attr.name}</td>
                            <td><span className="badge badge-success" style={{ background: 'rgba(11, 148, 133, 0.08)', color: 'var(--accent)', border: 'none' }}>{attr.dataType}</span></td>
                            <td>{attr.isRequired ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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
                        <div key={idx} className="attribute-row-input">
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Attribute Name (e.g. Size)" 
                            value={attr.name}
                            onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                            required
                          />
                          <select 
                            className="form-input" 
                            value={attr.dataType}
                            onChange={(e) => handleAttributeChange(idx, 'dataType', e.target.value)}
                          >
                            <option value="String">String</option>
                            <option value="Number">Number</option>
                            <option value="Boolean">Boolean</option>
                            <option value="DateTime">DateTime</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={attr.isRequired}
                              onChange={(e) => handleAttributeChange(idx, 'isRequired', e.target.checked)}
                            />
                            Required
                          </label>
                          <button type="button" className="attr-action-btn" onClick={() => handleRemoveAttributeRow(idx)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
