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

// ── Response interceptor: surface error messages cleanly ─────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';
    // Re-throw with a clean message property for components to display
    const enriched = new Error(message);
    enriched.status = error.response?.status;
    enriched.data   = error.response?.data;
    return Promise.reject(enriched);
  }
);

export default api;
