import axios from 'axios';

/**
 * Centralized Axios instance.
 * Base URL is set from VITE_API_URL env var, falling back to the Vite
 * dev proxy (/api → localhost:5000) so no CORS issues in development.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach stored JWT automatically ─────────────────────
api.interceptors.request.use(
  (config) => {
    // Decide which token to use based on the route prefix
    const isAdminRoute = config.url?.startsWith('/api/admin');
    const key = isAdminRoute ? 'el_admin_token' : 'el_guest_token';
    const token = localStorage.getItem(key);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: surface error messages + BUG-07: auto 401 redirect ─
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url || '';
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';

    // BUG-07 FIX: When a JWT is expired or invalid, automatically clear the
    // stale token and redirect the user to the correct login page.
    if (status === 401) {
      const isAdminRoute = url.startsWith('/api/admin');

      if (isAdminRoute) {
        localStorage.removeItem('el_admin_token');
        // Only redirect if not already on the login page (avoid redirect loops)
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
      } else {
        // For guest routes, extract eventId from the current URL to redirect back
        localStorage.removeItem('el_guest_token');
        localStorage.removeItem('el_event_info');
        const match = window.location.pathname.match(/\/event\/([^/]+)/);
        if (match && !window.location.pathname.includes('/event/' + match[1] + '/scan') === false) {
          // Already on scan page — redirect to guest login for this event
          window.location.href = `/event/${match[1]}`;
        }
      }
    }

    // Re-throw with a clean message property for components to display
    const enriched = new Error(message);
    enriched.status = status;
    enriched.data   = error.response?.data;
    return Promise.reject(enriched);
  }
);

export default api;
