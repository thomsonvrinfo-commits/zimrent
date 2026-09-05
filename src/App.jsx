import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import PropertyDetail from '@/pages/PropertyDetail';
import Profile from '@/pages/Profile';
import TenantDashboard from '@/pages/TenantDashboard';
import OwnerDashboard from '@/pages/OwnerDashboard';
import Messages from '@/pages/Messages';
import Reserve from '@/pages/Reserve';
import Apply from '@/pages/Apply';
import Agreement from '@/pages/Agreement';
import Tenancy from '@/pages/Tenancy';
import AddProperty from '@/pages/AddProperty';
import MyProperties from '@/pages/MyProperties';
import ApplicationReview from '@/pages/ApplicationReview';
import AdminDashboard from '@/pages/AdminDashboard';
import { Navigate } from 'react-router-dom';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/tenant-dashboard" element={<TenantDashboard />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
          <Route path="/reserve/:listingId" element={<Reserve />} />
          <Route path="/apply/:listingId" element={<Apply />} />
          <Route path="/agreement/:id" element={<Agreement />} />
          <Route path="/tenancy/:id" element={<Tenancy />} />
          <Route path="/add-property" element={<AddProperty />} />
          <Route path="/my-properties" element={<MyProperties />} />
          <Route path="/application/:id" element={<ApplicationReview />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App