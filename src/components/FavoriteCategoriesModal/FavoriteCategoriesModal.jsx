import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import categoryService from '../../services/categoryService';
import userFavoriteService from '../../services/userFavoriteService';
import { useToast } from '../../context/ToastContext';

export default function FavoriteCategoriesModal({ isOpen, onClose, currentFavorites, onUpdate }) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc");
        const arr = Array.isArray(data) ? data : (data?.value || []);
        // Only show root categories (no parentId) for simplicity
        setCategories(arr.filter(c => !c.parentId));
      } catch {
        showToast('Failed to load categories.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    setSelectedIds(new Set(currentFavorites.map(f => f.categoryId)));
  }, [isOpen]);

  const handleToggle = (categoryId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        if (next.size >= 3) {
          showToast('Maximum 3 favorite categories allowed.', 'warning');
          return prev;
        }
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentIds = new Set(currentFavorites.map(f => f.categoryId));
      
      // Remove unselected
      for (const fav of currentFavorites) {
        if (!selectedIds.has(fav.categoryId)) {
          await userFavoriteService.removeFavorite(fav.categoryId);
        }
      }

      // Add newly selected
      for (const id of selectedIds) {
        if (!currentIds.has(id)) {
          await userFavoriteService.addFavorite(id);
        }
      }

      showToast('Favorite categories updated!', 'success');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to update favorites.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '550px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fav-cat-modal-title"
      >
        <div className="modal-header">
          <h3 id="fav-cat-modal-title">Choose Favorite Categories</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Select up to 3 categories to personalize your homepage. Products from these categories will appear on your feed.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="product-loading-spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>Loading categories...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
              {categories.map(cat => (
                <label
                  key={cat.categoryId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: `1px solid ${selectedIds.has(cat.categoryId) ? 'rgba(6, 95, 70, 0.3)' : 'var(--border-color)'}`,
                    background: selectedIds.has(cat.categoryId) ? 'rgba(6, 95, 70, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(cat.categoryId)}
                    onChange={() => handleToggle(cat.categoryId)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</div>
                    {cat.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                        {cat.description.length > 80 ? cat.description.slice(0, 80) + '...' : cat.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'auto' }}>
            {selectedIds.size}/3 selected
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
