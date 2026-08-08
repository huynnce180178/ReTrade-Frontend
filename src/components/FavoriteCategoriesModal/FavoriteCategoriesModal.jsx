import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import categoryService from '../../services/categoryService';
import userFavoriteService from '../../services/userFavoriteService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

export default function FavoriteCategoriesModal({ isOpen, onClose, currentFavorites, onUpdate }) {
  const { showToast } = useToast();
  const { t } = useLanguage();
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
        setCategories(arr.filter(c => !c.parentId));
      } catch {
        showToast(t('common.error_occurred'), 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    setSelectedIds(new Set(currentFavorites.map(f => f.categoryId)));
  }, [isOpen, showToast, currentFavorites, t]);

  const handleToggle = (categoryId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        if (next.size >= 5) {
          return prev;
        }
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size < 1) {
      showToast(t('fav_modal.min_1_warning'), 'warning');
      return;
    }
    if (selectedIds.size > 5) {
      showToast(t('fav_modal.max_5_warning'), 'warning');
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(currentFavorites.map(f => f.categoryId));
      
      for (const fav of currentFavorites) {
        if (!selectedIds.has(fav.categoryId)) {
          await userFavoriteService.removeFavorite(fav.categoryId);
        }
      }

      for (const id of selectedIds) {
        if (!currentIds.has(id)) {
          await userFavoriteService.addFavorite(id);
        }
      }

      showToast(t('toast.saved_success'), 'success');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err?.response?.data || t('common.error_occurred'), 'error');
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
          <h3 id="fav-cat-modal-title">{t('fav_modal.title')}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('fav_modal.subtitle')}
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="product-loading-spinner" style={{ margin: '0 auto' }} />
              <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>{t('common.loading')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
              {categories.map(cat => {
                const isChecked = selectedIds.has(cat.categoryId);
                const isDisabled = !isChecked && selectedIds.size >= 5;

                return (
                  <label
                    key={cat.categoryId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--border-radius-sm)',
                      border: `1px solid ${isChecked ? 'rgba(6, 95, 70, 0.3)' : 'var(--border-color)'}`,
                      background: isChecked ? 'rgba(6, 95, 70, 0.04)' : 'transparent',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.45 : 1,
                      pointerEvents: isDisabled ? 'none' : 'auto',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => handleToggle(cat.categoryId)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                    />
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary, #000805)', lineHeight: '1.3' }}>
                      {cat.name}
                    </div>
                    {cat.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #717975)', marginTop: '2px', lineHeight: '1.3' }}>
                        {cat.description.length > 80 ? cat.description.slice(0, 80) + '...' : cat.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'auto' }}>
            {t('fav_modal.select_counter', { count: selectedIds.size })}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
