import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import categoryService from '../../../services/categoryService';
import '../../../styles/Home.css'; // Reuse home CSS for the category card styling, or inline some

export default function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc");
        const arr = Array.isArray(data) ? data : (data?.value || []);
        // Only show root categories for simplicity
        setCategories(arr.filter(c => !c.parentId));
      } catch {
        // Handle error if needed
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="container animate-fade-in" style={{ marginTop: '40px', marginBottom: '80px', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
          All Categories
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Browse our wide range of categories to find exactly what you're looking for.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="product-loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
          gap: '24px',
          justifyItems: 'center'
        }}>
          {categories.map(cat => (
            <Link 
              to={`/category/${cat.categoryId}`} 
              key={cat.categoryId} 
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                textDecoration: 'none',
                width: '100%',
                padding: '20px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-color)',
                transition: 'var(--transition-smooth)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = 'var(--secondary)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(2,36,27,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: '72px',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent'
              }}>
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '36px' }}>🏷️</span>
                )}
              </div>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-primary)', 
                textAlign: 'center',
                lineHeight: '1.3'
              }}>
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
