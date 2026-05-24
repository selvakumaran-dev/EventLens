/**
 * Modal — Reusable professional dialog system for EventLens
 *
 * Exports:
 *  • useModal()    — hook: { openConfirm, openAlert, openToast, close }
 *  • ModalProvider — wrap your app root with this
 *  • ConfirmModal  — destructive / warning confirm dialog
 *  • AlertModal    — info / success / error / warning modal
 *  Toast is built-in and auto-dismisses — no separate import needed.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Context ────────────────────────────────────────────────────────────────────
const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function ModalProvider({ children }) {
  const [modal,  setModal]  = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const openConfirm = useCallback((props) => setModal({ type: 'confirm', props }), []);
  const openAlert   = useCallback((props) => setModal({ type: 'alert',   props }), []);
  const close       = useCallback(() => setModal(null), []);

  /** openToast(message, variant?, durationMs?) — variant: success | error | warning | info */
  const openToast = useCallback((message, variant = 'success', duration = 3000) => {
    const id = ++toastId.current;
    setToasts((p) => [...p, { id, message, variant }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
  }, []);

  // ESC to close modal
  useEffect(() => {
    if (!modal) return;
    const fn = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [modal, close]);

  return (
    <ModalContext.Provider value={{ openConfirm, openAlert, openToast, close }}>
      {children}

      {/* Full-screen dialog */}
      <AnimatePresence>
        {modal && (
          <Backdrop onClose={close}>
            {modal.type === 'confirm' && <ConfirmModal {...modal.props} onClose={close} />}
            {modal.type === 'alert'   && <AlertModal   {...modal.props} onClose={close} />}
          </Backdrop>
        )}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000]
                      flex flex-col gap-2 items-center pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => <ToastItem key={t.id} message={t.message} variant={t.variant} />)}
        </AnimatePresence>
      </div>
    </ModalContext.Provider>
  );
}

// ── Backdrop ───────────────────────────────────────────────────────────────────
function Backdrop({ children, onClose }) {
  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-5"
      style={{ background: 'rgba(26,10,46,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 20  }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
const TOAST_CFG = {
  success: { dot: 'bg-emerald-500', label: '✓' },
  error:   { dot: 'bg-red-500',     label: '✕' },
  warning: { dot: 'bg-amber-500',   label: '!' },
  info:    { dot: 'bg-rose',        label: 'i' },
};

function ToastItem({ message, variant = 'success' }) {
  const c = TOAST_CFG[variant] || TOAST_CFG.info;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 10, scale: 0.92  }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl pointer-events-auto
                 bg-white/95 backdrop-blur-md border border-white/60"
      style={{ boxShadow: '0 8px 30px rgba(26,10,46,0.14)' }}
    >
      <span className={`w-5 h-5 rounded-full ${c.dot} text-white text-[10px] font-black
                        flex items-center justify-center flex-shrink-0`}>
        {c.label}
      </span>
      <span className="text-sm font-semibold text-text-primary whitespace-nowrap">{message}</span>
    </motion.div>
  );
}

// ── Shared icon + variant config ───────────────────────────────────────────────
const ICONS = {
  danger: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  warning: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  success: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  error: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  info: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const V = {
  danger:  { icon: 'text-red-500',     ring: 'bg-red-500/10 border-red-500/20',         btn: 'bg-red-500 hover:bg-red-600 text-white' },
  warning: { icon: 'text-amber-500',   ring: 'bg-amber-500/10 border-amber-500/20',     btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
  success: { icon: 'text-emerald-500', ring: 'bg-emerald-500/10 border-emerald-500/20', btn: null },
  error:   { icon: 'text-red-500',     ring: 'bg-red-500/10 border-red-500/20',         btn: null },
  info:    { icon: 'text-rose',        ring: 'bg-rose/10 border-rose/20',               btn: null },
};

// ── ConfirmModal ───────────────────────────────────────────────────────────────
export function ConfirmModal({
  title       = 'Are you sure?',
  message     = '',
  variant     = 'danger',
  confirmText = 'Confirm',
  cancelText  = 'Cancel',
  onConfirm,
  onClose,
}) {
  const s = V[variant] || V.danger;
  const handleConfirm = () => { onClose(); onConfirm?.(); };

  return (
    <div className="glass-card p-7 space-y-6 text-center"
         style={{ boxShadow: '0 25px 60px rgba(26,10,46,0.22)' }}>

      <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${s.ring}`}>
        <span className={s.icon}>{ICONS[variant] || ICONS.warning}</span>
      </div>

      <div className="space-y-2">
        <h3 className="heading-serif text-xl text-text-primary">{title}</h3>
        {message && <p className="text-text-muted text-sm leading-relaxed font-medium">{message}</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-ghost text-sm font-semibold py-2.5">
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all
                      duration-200 active:scale-95 ${s.btn || 'btn-rose'}`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}

// ── AlertModal ─────────────────────────────────────────────────────────────────
export function AlertModal({
  title      = 'Notice',
  message    = '',
  variant    = 'info',
  buttonText = 'Got it',
  onClose,
}) {
  const s = V[variant] || V.info;

  return (
    <div className="glass-card p-7 space-y-6 text-center"
         style={{ boxShadow: '0 25px 60px rgba(26,10,46,0.22)' }}>

      <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${s.ring}`}>
        <span className={s.icon}>{ICONS[variant] || ICONS.info}</span>
      </div>

      <div className="space-y-2">
        <h3 className="heading-serif text-xl text-text-primary">{title}</h3>
        {message && <p className="text-text-muted text-sm leading-relaxed font-medium">{message}</p>}
      </div>

      <button onClick={onClose} className="w-full btn-rose font-bold">
        {buttonText}
      </button>
    </div>
  );
}
