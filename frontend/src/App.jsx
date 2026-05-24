import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import GuestLogin from './pages/GuestLogin.jsx';
import GuestInterface from './pages/GuestInterface.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

/**
 * Route map:
 *  /                         → redirect to /admin/login
 *  /admin/login              → AdminLogin (no auth)
 *  /admin/dashboard          → AdminDashboard (admin JWT required)
 *  /event/:eventId           → GuestLogin (no auth — public QR landing)
 *  /event/:eventId/scan      → GuestInterface (guest JWT required)
 */
export default function App() {
  return (
    <Routes>
      {/* Root → Admin login */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Guest — QR code lands here */}
      <Route path="/event/:eventId" element={<GuestLogin />} />
      <Route
        path="/event/:eventId/scan"
        element={
          <ProtectedRoute role="guest">
            <GuestInterface />
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route
        path="*"
        element={
          <div className="h-screen-safe flex flex-col items-center justify-center gap-4 text-center px-6">
            <span className="text-6xl font-serif text-gold-gradient">404</span>
            <p className="text-text-muted">This page doesn't exist.</p>
          </div>
        }
      />
    </Routes>
  );
}
