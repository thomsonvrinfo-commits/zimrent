import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';

import Home from '@/pages/Home';
import PropertyDetails from '@/pages/PropertyDetails';
import AddProperty from '@/pages/AddProperty';
import MyProperties from '@/pages/MyProperties';
import TenantDashboard from '@/pages/TenantDashboard';
import OwnerDashboard from '@/pages/OwnerDashboard';
import Profile from '@/pages/Profile';
import AdminDashboard from '@/pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected application routes */}
          <Route
            element={
              <ProtectedRoute
                unauthenticatedElement={
                  <Navigate to="/login" replace />
                }
              />
            }
          >
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/property/:id" element={<PropertyDetails />} />
              <Route path="/add-property" element={<AddProperty />} />
              <Route path="/my-properties" element={<MyProperties />} />
              <Route path="/tenant-dashboard" element={<TenantDashboard />} />
              <Route path="/owner-dashboard" element={<OwnerDashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Admin-only route */}
          <Route
            element={
              <ProtectedRoute
                requireAdmin
                unauthenticatedElement={
                  <Navigate to="/login" replace />
                }
              />
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
