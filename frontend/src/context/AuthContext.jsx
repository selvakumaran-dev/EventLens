import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [guestToken, setGuestToken]   = useState(null);
  const [adminToken, setAdminToken]   = useState(null);
  const [eventInfo,  setEventInfo]    = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Rehydrate from localStorage on first mount
  useEffect(() => {
    const gt = localStorage.getItem('el_guest_token');
    const at = localStorage.getItem('el_admin_token');
    const ei = localStorage.getItem('el_event_info');

    if (gt) setGuestToken(gt);
    if (at) setAdminToken(at);
    if (ei) {
      try { setEventInfo(JSON.parse(ei)); } catch { /* stale/corrupt data */ }
    }

    setInitialized(true);
  }, []);

  const loginGuest = useCallback((token, event) => {
    localStorage.setItem('el_guest_token', token);
    localStorage.setItem('el_event_info', JSON.stringify(event));
    setGuestToken(token);
    setEventInfo(event);
  }, []);

  const loginAdmin = useCallback((token) => {
    localStorage.setItem('el_admin_token', token);
    setAdminToken(token);
  }, []);

  const logoutGuest = useCallback(() => {
    localStorage.removeItem('el_guest_token');
    localStorage.removeItem('el_event_info');
    setGuestToken(null);
    setEventInfo(null);
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem('el_admin_token');
    setAdminToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        guestToken,
        adminToken,
        eventInfo,
        initialized,
        loginGuest,
        loginAdmin,
        logoutGuest,
        logoutAdmin,
        isGuestAuthed: !!guestToken,
        isAdminAuthed: !!adminToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
