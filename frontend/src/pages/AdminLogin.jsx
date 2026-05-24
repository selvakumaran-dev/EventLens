import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Logo from '../components/Logo.jsx';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();

  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!secret.trim()) return setError('Admin secret is required.');

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/admin/login', { adminSecret: secret });
      loginAdmin(data.token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="ambient-glow w-[500px] h-[500px] -top-32 -left-32 opacity-25" />
      <div className="ambient-glow w-[400px] h-[400px] -bottom-20 -right-20 opacity-20" />

      {/* Card */}
      <div className="glass-card w-full max-w-md p-6 sm:p-8 space-y-6 sm:space-y-8 animate-scale-in z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4 animate-fade-in">
            <Logo variant="full" size="md" />
          </div>
          <p className="text-text-muted text-sm font-semibold">Photographer Admin Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Secret input */}
          <div className="input-floating">
            <input
              id="admin-secret"
              type={showSecret ? 'text' : 'password'}
              placeholder="Admin Secret"
              value={secret}
              onChange={(e) => { setSecret(e.target.value); setError(''); }}
              autoComplete="current-password"
              required
              className="pr-12"
            />
            <label htmlFor="admin-secret">Admin Secret</label>
            {/* Show/hide toggle */}
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted
                         hover:text-rose transition-colors"
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="admin-login-btn"
            type="submit"
            disabled={loading}
            className="btn-rose w-full font-bold shadow-rose"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Authenticating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Enter Dashboard
              </>
            )}
          </button>
        </form>

        <p className="text-center text-text-subtle text-xs font-semibold">
          EventLens Admin · For Photographers Only
        </p>
      </div>
    </div>
  );
}
