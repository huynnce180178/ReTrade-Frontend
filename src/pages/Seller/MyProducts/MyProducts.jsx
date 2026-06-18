import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import addressService from '../../../services/addressService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

export default function MyProducts() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatus, setSellerStatus] = useState('');
  const [sellerSort, setSellerSort] = useState('newest');
  
  const [isAddressPopupOpen, setIsAddressPopupOpen] = useState(false);

  const fetchMyProducts = async () => {
    if (!user?.userId) return;
    try {
      setProductsLoading(true);
      const params = { 
        sellerId: user.userId,
        SortBy: sellerSort,
        PageSize: 50
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
    if (user) {
      fetchMyProducts();
    }
  }, [user, sellerStatus, sellerSort]);

  const handleSellerSearchSubmit = (e) => {
    e.preventDefault();
    fetchMyProducts();
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
      navigate('/seller-dashboard/products/new');
    } catch (error) {
      showToast('Không thể xác thực thông tin địa chỉ giao hàng.', 'error');
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

  return (
    <>
      {productsLoading && (
        <div className="seller-loader-overlay">
          <span className="btn-spinner"></span>
        </div>
      )}

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
                            <button type="button" className="seller-icon-action" onClick={() => navigate(`/seller-dashboard/products/edit/${p.productId}`)}>
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

      {isAddressPopupOpen && (
        <AddressPopup 
          onClose={() => setIsAddressPopupOpen(false)} 
          onSelect={(selectedAddr) => {
            setIsAddressPopupOpen(false);
            showToast('Đã thêm địa chỉ thành công! Giờ bạn có thể tạo sản phẩm.', 'success');
            navigate('/seller-dashboard/products/new');
          }} 
        />
      )}
    </>
  );
}
