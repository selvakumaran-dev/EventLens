import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute
 * Redirects to the appropriate login page if the required token is absent.
 *
 * role="admin" → checks adminToken, redirects to /admin/login
 * role="guest" → checks guestToken, redirects to /event/:eventId
 *
 * Shows nothing (null) until AuthContext has rehydrated from localStorage
 * to prevent a flash-of-redirect on page refresh.
 */
export default function ProtectedRoute({ children, role }) {
  const { isAdminAuthed, isGuestAuthed, initialized } = useAuth();
  const { eventId } = useParams();

  // Wait for localStorage rehydration before making auth decisions
  if (!initialized) return null;

  if (role === 'admin' && !isAdminAuthed) {
    return <Navigate to="/admin/login" replace />;
  }

  if (role === 'guest' && !isGuestAuthed) {
    return <Navigate to={`/event/${eventId}`} replace />;
  }

  return children;
}
