import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Logo from '../components/Logo.jsx';

export default function GuestLogin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { loginGuest } = useAuth();

  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [eventInfo, setEventInfo]   = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);

  // Fetch event name for the personalized greeting (public endpoint)
  useEffect(() => {
    api
      .get(`/api/guest/event-info/${eventId}`)
      .then(({ data }) => setEventInfo(data.event))
      .catch(() => {}) // Non-critical — degrade gracefully
      .finally(() => setInfoLoading(false));
  }, [eventId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return setError('Please enter the event password.');

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/guest/login', { eventId, password });
      loginGuest(data.token, data.event);
      navigate(`/event/${eventId}/scan`);
    } catch (err) {
      setError(err.message || 'Incorrect password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe flex flex-col justify-between p-4 sm:p-6 bg-canvas relative overflow-y-auto">

      {/* ── Ambient background glows ────────────────────────────────────────── */}
      {/* Primary soft pink glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[450px] h-[450px] rounded-full pointer-events-none animate-float opacity-70"
        style={{
          background: 'radial-gradient(circle, rgba(255,77,141,0.15) 0%, rgba(255,140,97,0.08) 50%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Secondary lavender glow */}
      <div
        className="absolute bottom-10 left-10 w-[300px] h-[300px] rounded-full pointer-events-none animate-pulse-rose opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(155,110,232,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Celebratory Bokeh dots */}
      {[
        { size: 8, top: '12%', left: '18%', delay: '0s', color: 'rgba(255,77,141,0.45)' },      // Rose
        { size: 6, top: '25%', left: '80%', delay: '1.2s', color: 'rgba(255,140,97,0.45)' },    // Peach
        { size: 10, top: '65%', left: '8%',  delay: '2.4s', color: 'rgba(155,110,232,0.4)' },    // Lavender
        { size: 5, top: '78%', left: '72%', delay: '0.6s', color: 'rgba(255,184,48,0.5)' },     // Gold
        { size: 7, top: '42%', left: '88%', delay: '1.8s', color: 'rgba(255,77,141,0.3)' },      // Rose
      ].map((dot, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none animate-float"
          style={{
            width:  dot.size,
            height: dot.size,
            top:    dot.top,
            left:   dot.left,
            backgroundColor: dot.color,
            animationDelay:  dot.delay,
            filter: 'blur(0.5px)',
          }}
        />
      ))}

      {/* ── Top branding ──────────────────────────────────────────────────────── */}
      <div className="flex justify-center pt-8 animate-fade-in z-10">
        <Logo variant="full" size="md" />
      </div>

      {/* ── Main glass card ──────────────────────────────────────────────────── */}
      <div className="glass-card p-6 sm:p-7 space-y-6 sm:space-y-7 animate-scale-in z-10">
        {/* Greeting */}
        <div className="text-center space-y-2">
          <h1 className="heading-serif text-2xl leading-snug">
            {infoLoading ? (
              <span className="inline-block w-40 h-7 rounded skeleton animate-pulse" />
            ) : eventInfo ? (
              <>
                Welcome to<br />
                <span className="text-rose-gradient font-extrabold">{eventInfo.eventName}</span>
              </>
            ) : (
              'Welcome to EventLens'
            )}
          </h1>
          {eventInfo?.photographerName && (
            <p className="text-text-muted text-sm font-medium">
              Photography by{' '}
              <span className="text-rose font-semibold">{eventInfo.photographerName}</span>
            </p>
          )}
          <p className="text-text-muted text-xs pt-1">
            Enter the event password to find your photos instantly.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Floating-label password */}
          <div className="input-floating">
            <input
              id="event-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Event Password"
              maxLength={100}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              autoComplete="off"
              autoCapitalize="none"
              required
              className="pr-12"
            />
            <label htmlFor="event-password">Event Password</label>
            {/* Eye toggle */}
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted
                         hover:text-rose transition-colors"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? (
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
            <div
              role="alert"
              className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2 font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            id="guest-login-btn"
            type="submit"
            disabled={loading}
            className="btn-rose w-full text-base active:scale-95 transition-transform"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                Find My Photos
              </>
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
