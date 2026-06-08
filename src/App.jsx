import React from 'react';
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
import BidHistory from './pages/Buyer/BidHistory/BidHistory';
import Product from './pages/Buyer/Product/Product';
import Auction from './pages/Buyer/Auction/Auction';
import Wishlist from './pages/Buyer/Wishlist/Wishlist';
import Support from './pages/Buyer/Support/Support';
import UserProfile from './pages/Buyer/UserProfile/UserProfile';
import SellerProfile from './pages/Buyer/SellerProfile/SellerProfile';

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
                <Route path="auction" element={<Auction />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="support" element={<Support />} />
                <Route path="users/:userId" element={<UserProfile />} />
                <Route path="sellers/:sellerId" element={<SellerProfile />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="profile" element={<MyAccount />} />
                <Route path="my-account" element={<Navigate to="/profile" replace />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="address-book" element={<AddressBook />} />
                <Route path="purchase-history" element={<PurchaseHistory />} />
                <Route path="bid-history" element={<BidHistory />} />
                {/* Profile page removed */}
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
