import React from 'react';
import CategoryList from './pages/Buyer/Category/CategoryList';
import CategoryProductList from './pages/Buyer/Category/CategoryProductList';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const GOOGLE_CLIENT_ID = '743075993817-g2um0aknujbhp10vtfjmtg12gq6iaoid.apps.googleusercontent.com';
import MainLayout from './layouts/MainLayout/MainLayout';

import Home from './pages/Buyer/Home/Home';
import Login from './pages/Buyer/Login/Login';
import Register from './pages/Buyer/Register/Register';
import ForgotPassword from './pages/Buyer/ForgotPassword/ForgotPassword';
import ResetPassword from './pages/Buyer/ResetPassword/ResetPassword';
import MyAccount from './pages/Buyer/MyAccount/MyAccount';
import ChangePassword from './pages/Buyer/ChangePassword/ChangePassword';
import AddressBook from './pages/Buyer/AddressBook/AddressBook';
import PurchaseHistory from './pages/Buyer/PurchaseHistory/PurchaseHistory';
import PurchaseDetail from './pages/Buyer/PurchaseHistory/PurchaseDetail';
import BidHistory from './pages/Buyer/BidHistory/BidHistory';
import OfferHistory from './pages/Buyer/OfferHistory/OfferHistory';
import Product from './pages/Buyer/Product/Product';
import ProductDetail from './pages/Buyer/ProductDetail/ProductDetail';
import Auction from './pages/Buyer/Auction/Auction';
import AuctionDetail from './pages/Buyer/Auction/AuctionDetail';
import PaymentResult from './pages/Buyer/PaymentResult/PaymentResult';
import Wishlist from './pages/Buyer/Wishlist/Wishlist';
import Checkout from './pages/Buyer/Checkout/Checkout';

import Support from './pages/Buyer/Support/Support';
import Category from './pages/Buyer/Category/Category';
import AdminLayout from './layouts/AdminLayout/AdminLayout';
import SellerLayout from './layouts/SellerLayout/SellerLayout';
import UserProfile from './pages/Buyer/UserProfile/UserProfile';
import SellerProfile from './pages/Buyer/SellerProfile/SellerProfile';
import SellerDashboard from './pages/Seller/SellerDashboard/SellerDashboard';
import MyProducts from './pages/Seller/MyProducts/MyProducts';
import ProductForm from './pages/Seller/ProductForm/ProductForm';
import OrderManagement from './pages/Seller/OrderManagement/OrderManagement';
import OrderDetail from './pages/Seller/OrderDetail/OrderDetail';
import OrderStatusUpdate from './pages/Seller/OrderStatusUpdate/OrderStatusUpdate';
import SalesStatistics from './pages/Seller/SalesStatistics/SalesStatistics';
import MyAuctions from './pages/Seller/MyAuctions/MyAuctions';
import UserAccounts from './pages/Admin/UserAccounts/UserAccounts';
import Listings from './pages/Admin/Listings/Listings';
import AuctionControl from './pages/Admin/Auctions/AuctionControl';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Home />} />
                <Route path="product" element={<Product />} />
                <Route path="product/:productId" element={<ProductDetail />} />
                <Route path="auction" element={<Auction />} />
                <Route path="auction/:auctionId" element={<AuctionDetail />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="checkout/:productId" element={<Checkout />} />

                <Route path="support" element={<Support />} />
                <Route path="users/:userId" element={<UserProfile />} />
                <Route path="sellers/:sellerId" element={<SellerProfile />} />
                <Route path="seller-dashboard" element={<SellerLayout />}>
                  <Route index element={<SellerDashboard />} />
                  <Route path="products" element={<MyProducts />} />
                  <Route path="products/new" element={<ProductForm />} />
                  <Route path="products/edit/:productId" element={<ProductForm />} />
                  <Route path="sales-statistics" element={<SalesStatistics />} />
                  <Route path="auctions" element={<MyAuctions />} />
                  <Route path="orders" element={<OrderManagement />} />
                  <Route path="orders/:orderId/status" element={<OrderStatusUpdate />} />
                  <Route path="orders/:orderId" element={<OrderDetail />} />
                </Route>
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="profile" element={<MyAccount />} />
                <Route path="my-account" element={<Navigate to="/profile" replace />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="address-book" element={<AddressBook />} />
                <Route path="purchase-history" element={<PurchaseHistory />} />
                <Route path="purchase-history/:orderId" element={<PurchaseDetail />} />
                <Route path="bid-history" element={<BidHistory />} />
                <Route path="offer-history" element={<OfferHistory />} />
                <Route path="payment/vnpay-return" element={<PaymentResult />} />
                <Route path="category" element={<CategoryList />} />
                <Route path="category/:categoryId" element={<CategoryProductList />} />
                {/* Profile page removed */}
              </Route>

              {/* Admin Panel Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/category" replace />} />
                <Route path="category" element={<Category />} />
                <Route path="users" element={<UserAccounts />} />
                <Route path="listings" element={<Listings />} />
                <Route path="auctions" element={<AuctionControl />} />
                <Route path="*" element={
                  <div className="admin-placeholder-page">
                    <span className="material-symbols-outlined admin-placeholder-icon">construction</span>
                    <h2>Feature Under Construction</h2>
                    <p>This administrative view is currently empty. Category Management and User Accounts are fully implemented.</p>
                  </div>
                } />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
