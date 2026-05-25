import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import { loadAdminModels, extractAllDescriptors } from '../utils/faceApiLoader.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Logo from '../components/Logo.jsx';
import { useModal } from '../components/Modal.jsx';
import QRCode from '../components/QRCode.jsx';

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

// ── Upload a single file to Cloudinary via REST (no widget needed) ────────────
async function uploadToCloudinary(file, eventId, onProgress) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  if (file.size <= 5 * 1024 * 1024) {
    // Standard upload for files <= 5MB
    const fd  = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('folder', `eventlens/${eventId}`);

    const res  = await fetch(url, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
    if (onProgress) onProgress(100);
    return { url: data.secure_url, publicId: data.public_id };
  } else {
    // Chunked upload for files > 5MB to handle massive sizes reliably
    const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks (> 5MB limit)
    const totalSize = file.size;
    const uniqueUploadId = 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    let start = 0;
    let responseData = null;

    while (start < totalSize) {
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = file.slice(start, end);
      const chunkStart = start;
      const chunkEnd = end - 1;

      const fd = new FormData();
      fd.append('file', chunk);
      fd.append('upload_preset', UPLOAD_PRESET);
      fd.append('folder', `eventlens/${eventId}`);

      const headers = {
        'X-Unique-Upload-Id': uniqueUploadId,
        'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalSize}`
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: fd
      });

      responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error?.message || 'Chunked upload failed');
      }

      start = end;
      if (onProgress) {
        onProgress(Math.min(100, Math.round((start / totalSize) * 100)));
      }
    }

    if (!responseData || !responseData.secure_url) {
      throw new Error('Cloudinary upload response missing secure URL');
    }

    return { url: responseData.secure_url, publicId: responseData.public_id };
  }
}

export default function AdminDashboard() {
  const navigate     = useNavigate();
  const { logoutAdmin } = useAuth();
  const fileInputRef = useRef(null);
  const widgetRef    = useRef(null);
  const { openConfirm, openAlert, openToast } = useModal();

  // ── Events ────────────────────────────────────────────────────────────────
  const [events,        setEvents]        = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');

  // ── Create form ───────────────────────────────────────────────────────────
  const [newEventName,  setNewEventName]  = useState('');
  const [newEventPass,  setNewEventPass]  = useState('');
  const [photographer,  setPhotographer]  = useState('');
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [createSuccess, setCreateSuccess] = useState(null);

  // ── Upload workflow ───────────────────────────────────────────────────────
  const [selectedFiles,   setSelectedFiles]   = useState([]);   // File[] from input
  const [uploadedUrls,    setUploadedUrls]     = useState([]);   // {url,publicId}[]
  const [uploading,       setUploading]        = useState(false);
  const [uploadProgress,  setUploadProgress]   = useState({ done: 0, total: 0, phase: '' });
  const [processingFaces, setProcessingFaces]  = useState(false);
  const [uploadError,     setUploadError]      = useState('');
  const [uploadSuccess,   setUploadSuccess]    = useState('');

  // ── face-api models ───────────────────────────────────────────────────────
  const [modelsReady,   setModelsReady]   = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError,   setModelsError]   = useState('');

  // ── Change Password Modal State ──────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword,   setCurrentPassword]   = useState('');
  const [newPassword,       setNewPassword]       = useState('');
  const [confirmPassword,   setConfirmPassword]   = useState('');
  const [passwordError,     setPasswordError]     = useState('');
  const [passwordSuccess,   setPasswordSuccess]   = useState('');
  const [passwordLoading,   setPasswordLoading]   = useState(false);

  // ── View QR Code Modal State ─────────────────────────────────────────────
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrEvent, setSelectedQrEvent] = useState(null);

  // ── Load events ───────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const { data } = await api.get('/api/admin/events');
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Pre-load AI models silently in the background after mount ─────────────
  useEffect(() => {
    setModelsLoading(true);
    loadAdminModels()
      .then(() => setModelsReady(true))
      .catch((e) => setModelsError(e.message))
      .finally(() => setModelsLoading(false));
  }, []);

  // ── Create event ──────────────────────────────────────────────────────────
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventPass.trim())
      return setCreateError('Event name and password are required.');

    setCreating(true);
    setCreateError('');
    setCreateSuccess(null);
    try {
      const { data } = await api.post('/api/admin/events', {
        eventName: newEventName.trim(),
        eventPassword: newEventPass.trim(),
        photographerName: photographer.trim(),
      });
      setCreateSuccess(data.event);
      setNewEventName('');
      setNewEventPass('');
      setPhotographer('');
      fetchEvents();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDeleteEvent = (id, name) => {
    openConfirm({
      title: 'Delete Event?',
      message: `"${name}" and all its photos will be permanently removed. This cannot be undone.`,
      variant: 'danger',
      confirmText: 'Yes, Delete',
      cancelText: 'Keep It',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/events/${id}`);
          if (selectedEventId === id) setSelectedEventId('');
          fetchEvents();
        } catch (err) {
          openAlert({
            title: 'Delete Failed',
            message: err.message || 'Something went wrong. Please try again.',
            variant: 'error',
            buttonText: 'Close',
          });
        }
      },
    });
  };

  // ── File input → stage files ───────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Pre-generate object URLs once upon selection to avoid memory leaks on re-renders
    const newStaged = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedFiles((prev) => [...prev, ...newStaged]);
    setUploadError('');
    setUploadSuccess('');
    // Reset input so same files can be re-selected if cleared
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setSelectedFiles((prev) => {
      const target = prev[idx];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearAll = () => {
    // Revoke all object URLs to prevent browser memory leaks
    selectedFiles.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedFiles([]);
    setUploadedUrls([]);
    setUploadError('');
    setUploadSuccess('');
  };

  // ── ONE-CLICK LIGHTNING UPLOAD & PROCESS ──────────────────────────────────
  const handleLightningUploadAndProcess = async () => {
    if (!selectedEventId) return setUploadError('⚠️ Select an event first.');
    if (!selectedFiles.length) return setUploadError('⚠️ Add photos first.');
    if (!modelsReady) {
      return setUploadError('⚠️ AI models still loading. Please wait a moment and try again.');
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return setUploadError(
        '⚠️ Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to frontend/.env.'
      );
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadProgress({ done: 0, total: selectedFiles.length, phase: 'Initializing parallel workers...' });

    const photoDocs = [];
    let completedCount = 0;

    // Helper: Local Image Loader (Loads File into memory directly - 0 network delay)
    const loadImageLocally = (file) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => resolve({ img, objectUrl });
        img.onerror = (err) => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load local image file.'));
        };
        img.src = objectUrl;
      });
    };

    // Parallel Worker Function for a single photo
    const processSinglePhoto = async (item) => {
      const { file } = item;
      let descriptors = [];
      let uploadResult = null;

      // Pipeline Step A (AI extraction) & Step B (Cloudinary upload) in parallel!
      const aiTask = (async () => {
        try {
          const { img, objectUrl } = await loadImageLocally(file);
          descriptors = await extractAllDescriptors(img);
          URL.revokeObjectURL(objectUrl); // Release memory immediately!
        } catch (aiErr) {
          console.warn(`⚠️ AI processing failed locally for ${file.name}:`, aiErr.message);
        }
      })();

      const uploadTask = (async () => {
        try {
          uploadResult = await uploadToCloudinary(file, selectedEventId, null);
        } catch (uploadErr) {
          throw new Error(`Cloudinary upload failed for "${file.name}": ${uploadErr.message}`);
        }
      })();

      // Wait for BOTH AI extraction and Cloudinary upload to complete in parallel
      await Promise.all([aiTask, uploadTask]);

      if (uploadResult) {
        photoDocs.push({
          eventId: selectedEventId,
          storageUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          faceDescriptors: descriptors.map((d) => ({ vector: Array.from(d) })),
        });
      }

      completedCount++;
      setUploadProgress({
        done: completedCount,
        total: selectedFiles.length,
        phase: `Processed ${completedCount} of ${selectedFiles.length} photos...`
      });
    };

    // Sliding Concurrency Queue (Max 3 concurrent workers to protect CPU/RAM)
    const concurrency = 3;
    const executing = new Set();
    const errors = [];

    for (const item of selectedFiles) {
      const p = processSinglePhoto(item).catch((err) => {
        console.error(err);
        errors.push(err.message);
      });
      executing.add(p);

      const clean = () => executing.delete(p);
      p.then(clean, clean);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    // Wait for trailing workers to complete
    await Promise.all(executing);

    // Clean up all object URLs to release memory
    selectedFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });

    if (photoDocs.length === 0) {
      setUploading(false);
      return setUploadError(`⚠️ All photo processing failed: ${errors.join(', ')}`);
    }

    // STEP 4: Bulk Save to MongoDB
    try {
      setUploadProgress({ done: selectedFiles.length, total: selectedFiles.length, phase: 'Saving metadata to MongoDB...' });
      const BATCH = 200;
      for (let b = 0; b < photoDocs.length; b += BATCH) {
        await api.post('/api/admin/upload-metadata', { photos: photoDocs.slice(b, b + BATCH) });
      }
      
      setUploadSuccess(`✓ Success! ${photoDocs.length} photo(s) uploaded and AI face descriptors saved.`);
      setSelectedFiles([]);
      setUploadedUrls([]);
      fetchEvents();
    } catch (saveErr) {
      setUploadError('Database save failed: ' + saveErr.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Cloudinary widget (optional — if credentials are set) ─────────────────
  const openWidget = async () => {
    if (!selectedEventId) return setUploadError('⚠️ Select an event first.');
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return setUploadError('⚠️ Cloudinary credentials missing in .env');
    }

    if (!window.cloudinary) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://upload-widget.cloudinary.com/global/all.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    if (!widgetRef.current) {
      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET,
          folder: `eventlens/${selectedEventId}`,
          sources: ['local', 'camera', 'google_drive'],
          multiple: true, maxFiles: 200,
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
          maxFileSize: 20_000_000,
          styles: {
            palette: {
              window: '#FFFFFF',
              windowBorder: '#FF4D8D',
              tabIcon: '#FF4D8D',
              link: '#9B6EE8',
              action: '#FF4D8D',
              inProgress: '#FF8C61',
              complete: '#10B981',
              error: '#EF4444',
              textDark: '#1A0A2E',
              textLight: '#FFFFFF',
              sourceBg: '#FDF4FF'
            }
          },
        },
        (error, result) => {
          if (error) return setUploadError('Widget error: ' + error.message);
          if (result.event === 'success')
            setUploadedUrls((p) => [...p, { url: result.info.secure_url, publicId: result.info.public_id }]);
        }
      );
    }
    widgetRef.current.open();
  };

  const handleLogout = () => { logoutAdmin(); navigate('/admin/login'); };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return setPasswordError('All fields are required.');
    }

    if (newPassword.length < 4) {
      return setPasswordError('New password must be at least 4 characters.');
    }

    if (newPassword !== confirmPassword) {
      return setPasswordError('New passwords do not match.');
    }

    setPasswordLoading(true);
    try {
      const { data } = await api.put('/api/admin/change-password', {
        currentPassword,
        newPassword,
      });

      setPasswordSuccess(data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      openToast('Password changed successfully!', 'success');

      // Auto close after 1.5 seconds
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.response?.data?.message || err.message || 'Password change failed.');
    } finally {
      setPasswordLoading(false);
    }
  };
  const guestUrl = (id) => `${window.location.origin}/event/${id}`;
  const copyUrl  = (url) =>
    navigator.clipboard.writeText(url)
      .then(() => openToast('Guest link copied!', 'success'))
      .catch(() => openToast('Copy failed — try manually.', 'error'));

  const progressPct = uploadProgress.total > 0
    ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0;

  const isWorking = uploading || processingFaces;

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-rose-pale/40 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between
                      sticky top-0 z-30 bg-canvas/80 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Logo variant="full" size="sm" />
          <span className="hidden sm:inline-block text-text-muted text-[10px] tracking-widest uppercase font-semibold border-l border-lavender-light pl-3 ml-1">Admin Dashboard</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn-ghost text-sm py-2 px-2.5 sm:px-4 font-semibold text-rose hover:text-rose-dark flex items-center justify-center"
            title="Change Password"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="hidden sm:inline ml-1">Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="btn-ghost text-sm py-2 px-2.5 sm:px-4 font-semibold flex items-center justify-center"
            title="Logout"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline ml-1">Logout</span>
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── ROW 1: Create Event + Events List ───────────────────────────── */}
        <div className="grid md:grid-cols-[360px,1fr] gap-6 items-start">

          {/* Create Event Card */}
          <div className="glass-card p-6 space-y-5">
            <div>
              <h2 className="heading-serif text-xl text-rose">Create Event</h2>
              <p className="text-text-muted text-xs mt-1 font-semibold">Generates a unique QR-ready guest URL.</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4" noValidate>
              <div className="input-floating">
                <input id="event-name" type="text" placeholder="Event Name"
                  value={newEventName} onChange={(e) => { setNewEventName(e.target.value); setCreateError(''); }} required />
                <label htmlFor="event-name">Event Name</label>
              </div>
              <div className="input-floating">
                <input id="event-pass" type="text" placeholder="Guest Password"
                  value={newEventPass} onChange={(e) => { setNewEventPass(e.target.value); setCreateError(''); }} required />
                <label htmlFor="event-pass">Guest Password</label>
              </div>
              <div className="input-floating">
                <input id="photographer" type="text" placeholder="Photographer Name"
                  value={photographer} onChange={(e) => setPhotographer(e.target.value)} />
                <label htmlFor="photographer">Photographer (optional)</label>
              </div>

              {createError && (
                <p className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-semibold">{createError}</p>
              )}

              <button id="create-event-btn" type="submit" disabled={creating} className="btn-rose w-full font-bold shadow-rose">
                {creating ? <LoadingSpinner size="sm" /> : '+ Create Event'}
              </button>
            </form>

            {/* ── Success: QR Code Card ────────────────────────── */}
            <AnimatePresence>
              {createSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0,  scale: 1    }}
                  exit={{    opacity: 0, y: 8,  scale: 0.97  }}
                  className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white"
                           strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    "{createSuccess.eventName}" created!
                  </div>

                  {/* QR Code — centered with white card + brand watermark */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-card border border-rose-pale/40 space-y-2">
                      <QRCode
                        value={guestUrl(createSuccess._id)}
                        size={168}
                        fgColor="#1A0A2E"
                        bgColor="#ffffff"
                      />
                      {/* Brand footer inside QR card */}
                      <div className="flex items-center justify-center gap-1.5 pt-1">
                        <Logo variant="icon" size="sm" />
                        <span className="text-[9px] text-text-muted font-bold tracking-widest uppercase">
                          EventLens
                        </span>
                      </div>
                    </div>
                    <p className="text-text-muted text-[10px] font-semibold text-center">
                      Scan to access event as guest
                    </p>
                  </div>

                  {/* Guest URL row */}
                  <div className="space-y-1.5">
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
                      Guest Link
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-rose text-[10px] break-all flex-1 bg-white border
                                       border-rose-pale rounded-lg px-2.5 py-2 font-bold leading-relaxed">
                        {guestUrl(createSuccess._id)}
                      </code>
                      {/* Copy button */}
                      <button
                        onClick={() => copyUrl(guestUrl(createSuccess._id))}
                        title="Copy guest link"
                        className="w-8 h-8 rounded-lg bg-white border border-rose-pale flex items-center
                                   justify-center text-text-muted hover:text-rose hover:border-rose/30
                                   transition-colors flex-shrink-0"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Download QR button */}
                  <a
                    href={`https://quickchart.io/qr?text=${encodeURIComponent(guestUrl(createSuccess._id))}&size=400&dark=1A0A2E&light=ffffff`}
                    download={`eventlens-qr-${createSuccess._id}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                               border border-rose/30 bg-rose/5 text-rose text-xs font-bold
                               hover:bg-rose/10 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download QR Code (PNG)
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Events List Card */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="heading-serif text-xl text-rose">Your Events</h2>
              <span className="text-text-muted text-xs font-semibold">{events.length} total</span>
            </div>

            {selectedEventId && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-rose-pale/40 border border-rose/30 text-rose rounded-xl px-4 py-3 font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose animate-ping flex-shrink-0" />
                  ✓ Event selected: "{events.find((e) => e._id === selectedEventId)?.eventName || 'Selected Event'}"
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ev = events.find((item) => item._id === selectedEventId);
                      if (ev) {
                        setSelectedQrEvent(ev);
                        setShowQrModal(true);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose text-white hover:bg-rose-dark active:scale-95 transition-all font-bold shadow-rose"
                    title="View QR Code"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                      <path d="M7 17h.01M17 17h.01M17 7h.01"/>
                    </svg>
                    QR Code
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyUrl(guestUrl(selectedEventId));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-pale text-rose hover:bg-rose/5 active:scale-95 transition-all font-bold"
                    title="Copy guest URL"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Link
                  </button>
                </div>
              </div>
            )}

            {eventsLoading ? (
              <div className="py-8"><LoadingSpinner message="Loading events…" /></div>
            ) : events.length === 0 ? (
              <div className="text-center py-10 text-text-muted text-sm font-semibold">
                No events yet. Create your first one ↑
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {events.map((ev) => (
                  <div key={ev._id}
                    onClick={() => { setSelectedEventId(ev._id); setUploadError(''); }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer
                               border transition-all duration-200 group"
                    style={{
                      background: selectedEventId === ev._id ? 'rgba(255, 77, 141, 0.05)' : '#FFFFFF',
                      borderColor: selectedEventId === ev._id ? 'rgba(255, 77, 141, 0.35)' : 'rgba(155, 110, 232, 0.15)',
                    }}>
                    {/* Selection indicator */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors
                      ${selectedEventId === ev._id ? 'bg-rose shadow-rose animate-pulse' : 'bg-lavender-light'}`} />

                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-semibold truncate">{ev.eventName}</p>
                      <p className="text-text-muted text-xs mt-0.5 font-semibold">
                        {ev.photoCount} photo{ev.photoCount !== 1 ? 's' : ''} · {new Date(ev.createdAt).toLocaleDateString('en-IN')}
                        {ev.photographerName && ` · ${ev.photographerName}`}
                      </p>
                    </div>

                    {/* Actions Group (Thumb isolated for mobile responsiveness) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 pl-2 border-l border-lavender-light/30">
                      {/* View QR Code */}
                      <button onClick={(e) => { e.stopPropagation(); setSelectedQrEvent(ev); setShowQrModal(true); }}
                        className="text-text-muted hover:text-rose transition-colors p-2.5 sm:p-1.5 active:scale-95 duration-100 flex items-center justify-center rounded-lg hover:bg-rose/5"
                        title="View QR Code">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"/>
                          <rect x="14" y="3" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/>
                          <path d="M7 17h.01M17 17h.01M17 7h.01"/>
                        </svg>
                      </button>

                      {/* Copy guest link */}
                      <button onClick={(e) => { e.stopPropagation(); copyUrl(guestUrl(ev._id)); }}
                        className="text-text-muted hover:text-rose transition-colors p-2.5 sm:p-1.5 active:scale-95 duration-100 flex items-center justify-center rounded-lg hover:bg-rose/5"
                        title="Copy guest URL">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                      </button>

                      {/* Delete */}
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev._id, ev.eventName); }}
                        className="text-text-muted hover:text-red-500 transition-colors p-2.5 sm:p-1.5 active:scale-95 duration-100 flex items-center justify-center rounded-lg hover:bg-red-50"
                        title="Delete event">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 2: Upload & Process ──────────────────────────────────────── */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="heading-serif text-xl text-rose">Upload & Process Photos</h2>
              <p className="text-text-muted text-xs mt-1 font-semibold">
                {selectedEventId
                  ? `Staging uploads for: ${events.find(e => e._id === selectedEventId)?.eventName || selectedEventId}`
                  : 'Select an event above first, then upload photos here.'}
              </p>
            </div>
            {(selectedFiles.length > 0 || uploadedUrls.length > 0) && (
              <button onClick={clearAll} disabled={isWorking}
                className="text-text-muted hover:text-red-500 text-xs font-semibold transition-colors flex-shrink-0 mt-1">
                Clear all
              </button>
            )}
          </div>

          {/* ── STEP 1: Pick files ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${selectedFiles.length > 0 || uploadedUrls.length > 0
                  ? 'bg-rose text-white shadow-rose' : 'bg-rose-pale text-text-muted border border-rose/10'}`}>
                {selectedFiles.length > 0 || uploadedUrls.length > 0 ? '✓' : '1'}
              </span>
              <span className="text-text-primary text-sm font-semibold">Select Photos</span>
            </div>

            {/* Drop zone / file picker */}
            <div
              onClick={() => !isWorking && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center
                         transition-all duration-200 cursor-pointer
                         ${isWorking
                           ? 'opacity-40 cursor-not-allowed border-rose-pale/40'
                           : selectedFiles.length > 0
                           ? 'border-rose/40 bg-rose/5'
                           : 'border-rose-pale hover:border-rose/30 hover:bg-rose/5'}`}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*"
                className="hidden" onChange={handleFileSelect} id="photo-file-input" />

              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-rose text-3xl animate-bounce">🌸</div>
                  <p className="text-text-primary text-sm font-bold">
                    {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-text-muted text-xs font-semibold">Click to add more photos</p>
                </div>
              ) : uploadedUrls.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-emerald-500 text-3xl">✅</div>
                  <p className="text-text-primary text-sm font-bold">
                    {uploadedUrls.length} photo{uploadedUrls.length !== 1 ? 's' : ''} uploaded to Cloudinary
                  </p>
                  <p className="text-text-muted text-xs font-semibold">Click to add more photos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg className="mx-auto text-rose" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <div>
                    <p className="text-text-primary text-sm font-semibold">Click to select photos</p>
                    <p className="text-text-muted text-xs mt-1 font-semibold">JPG, PNG, WEBP, HEIC — up to 200 photos at once</p>
                  </div>
                </div>
              )}
            </div>

            {/* File list preview */}
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {selectedFiles.map(({ file, previewUrl }, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden bg-white border border-rose-pale">
                    <img src={previewUrl} alt={file.name}
                      className="w-full h-16 object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 text-white
                                 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-xs
                                 flex items-center justify-center shadow-md active:scale-90"
                      title="Remove staged photo">
                      ✕
                    </button>
                    <p className="text-[9px] text-text-muted truncate px-1 pb-1 pt-0.5 font-semibold">{file.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── STEP 2: Fast Upload & AI Process ─────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${uploadSuccess ? 'bg-rose text-white shadow-rose' : 'bg-rose-pale text-text-muted border border-rose/10'}`}>
                {uploadSuccess ? '✓' : '2'}
              </span>
              <span className="text-text-primary text-sm font-semibold">Fast Upload & AI Process</span>
              {modelsLoading && (
                <span className="text-text-muted text-[10px] flex items-center gap-1 font-semibold">
                  <div className="w-3 h-3 border border-rose/20 border-t-rose rounded-full animate-spin"/>
                  AI loading…
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Primary: direct lightning parallel upload */}
              <button id="lightning-upload-btn"
                onClick={handleLightningUploadAndProcess}
                disabled={isWorking || !selectedFiles.length || !selectedEventId || !modelsReady}
                className="btn-rose w-full sm:w-auto font-bold shadow-rose">
                {isWorking ? (
                  <><LoadingSpinner size="sm" />Processing {uploadProgress.done}/{uploadProgress.total}…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                    Lightning Upload & Process {selectedFiles.length > 0 ? `(${selectedFiles.length} photo${selectedFiles.length !== 1 ? 's' : ''})` : ''}
                  </>
                )}
              </button>

              {/* Secondary: Cloudinary widget (optional — if credentials set) */}
              {CLOUD_NAME && (
                <button onClick={openWidget} disabled={isWorking || !selectedEventId} className="btn-ghost w-full sm:w-auto text-sm font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                  </svg>
                  Cloudinary Widget
                </button>
              )}
            </div>

            {/* Cloudinary setup hint */}
            {!CLOUD_NAME && (
              <div className="text-amber-600 text-xs bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 space-y-1 font-semibold">
                <p className="font-bold">Set up Cloudinary to enable uploads:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-amber-600/80">
                  <li>Create free account at <span className="text-rose">cloudinary.com</span></li>
                  <li>Create an <span className="text-rose">unsigned upload preset</span> in Settings → Upload</li>
                  <li>Add to <code className="bg-white px-1 rounded border border-rose-pale">frontend/.env</code>:</li>
                </ol>
                <pre className="text-text-primary text-[10px] bg-white rounded border border-rose-pale p-2 mt-1 overflow-x-auto font-mono">
{`VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset`}
                </pre>
                <p className="text-text-muted">Then restart the Vite dev server.</p>
              </div>
            )}
          </div>

          {/* ── Progress bar ───────────────────────────────────────────────── */}
          {isWorking && uploadProgress.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-text-muted font-semibold">
                <span>{uploadProgress.phase}…</span>
                <span>{progressPct}% ({uploadProgress.done}/{uploadProgress.total})</span>
              </div>
              <div className="h-1.5 bg-rose-pale rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-rose to-peach rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3 }} />
              </div>
              <p className="text-text-muted text-[10px] font-semibold">
                {processingFaces
                  ? 'face-api.js running locally in this tab — zero server load.'
                  : 'Uploading photos directly to Cloudinary CDN.'}
              </p>
            </div>
          )}

          {/* ── Errors & Success ────────────────────────────────────────────── */}
          {uploadError && (
            <div className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 font-semibold">
              {uploadError}
            </div>
          )}
          {modelsError && (
            <div className="text-amber-600 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 font-semibold">
              ⚠️ AI model error: {modelsError}. Face extraction may fail.
            </div>
          )}
          {uploadSuccess && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="text-emerald-600 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 font-bold">
              {uploadSuccess}
            </motion.div>
          )}
        </div>


      </div>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-canvas/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => !passwordLoading && setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="glass-card w-full max-w-md p-6 space-y-6 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative top pink glow */}
              <div className="absolute -top-12 -left-12 w-24 h-24 bg-rose/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-peach/10 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose/10 flex items-center justify-center text-rose">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="heading-serif text-lg text-rose">Change Password</h3>
                    <p className="text-text-muted text-xs font-semibold">Update admin account credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                  className="w-8 h-8 rounded-full border border-lavender-light flex items-center justify-center text-text-muted hover:text-rose hover:border-rose/30 transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                <div className="input-floating">
                  <input
                    id="current-password"
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                    required
                    disabled={passwordLoading}
                  />
                  <label htmlFor="current-password">Current Password</label>
                </div>

                <div className="input-floating">
                  <input
                    id="new-password"
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                    required
                    disabled={passwordLoading}
                  />
                  <label htmlFor="new-password">New Password (min 4 chars)</label>
                </div>

                <div className="input-floating">
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                    required
                    disabled={passwordLoading}
                  />
                  <label htmlFor="confirm-password">Confirm New Password</label>
                </div>

                {passwordError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-semibold"
                  >
                    {passwordError}
                  </motion.p>
                )}

                {passwordSuccess && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-600 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 font-bold"
                  >
                    {passwordSuccess}
                  </motion.p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passwordLoading}
                    className="btn-ghost flex-1 py-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="btn-rose flex-1 font-bold shadow-rose"
                  >
                    {passwordLoading ? <LoadingSpinner size="sm" /> : 'Update'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── View QR Code Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQrModal && selectedQrEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-canvas/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="glass-card w-full max-w-sm p-6 space-y-6 relative overflow-hidden text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative glows */}
              <div className="absolute -top-12 -left-12 w-24 h-24 bg-rose/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-peach/10 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-start justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose/10 flex items-center justify-center text-rose">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="heading-serif text-lg text-rose">Event QR Code</h3>
                    <p className="text-text-muted text-xs font-semibold">Scan to access the event</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="w-8 h-8 rounded-full border border-lavender-light flex items-center justify-center text-text-muted hover:text-rose hover:border-rose/30 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* QR Code and watermarked brand details */}
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-card border border-rose-pale/40 space-y-2">
                  <QRCode
                    value={guestUrl(selectedQrEvent._id)}
                    size={180}
                    fgColor="#1A0A2E"
                    bgColor="#ffffff"
                  />
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <Logo variant="icon" size="sm" />
                    <span className="text-[9px] text-text-muted font-bold tracking-widest uppercase">
                      EventLens
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-text-primary font-bold text-sm">{selectedQrEvent.eventName}</p>
                  <p className="text-text-muted text-[10px] font-semibold">
                    Created on {new Date(selectedQrEvent.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Guest URL copy block */}
              <div className="space-y-1.5 text-left">
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">
                  Guest Link
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-rose text-[10px] break-all flex-1 bg-white border
                                   border-rose-pale rounded-lg px-2.5 py-2 font-bold leading-relaxed">
                    {guestUrl(selectedQrEvent._id)}
                  </code>
                  <button
                    onClick={() => copyUrl(guestUrl(selectedQrEvent._id))}
                    title="Copy guest link"
                    className="w-8 h-8 rounded-lg bg-white border border-rose-pale flex items-center
                               justify-center text-text-muted hover:text-rose hover:border-rose/30
                               transition-colors flex-shrink-0"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Download link */}
              <a
                href={`https://quickchart.io/qr?text=${encodeURIComponent(guestUrl(selectedQrEvent._id))}&size=400&dark=1A0A2E&light=ffffff`}
                download={`eventlens-qr-${selectedQrEvent._id}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                           border border-rose/30 bg-rose/5 text-rose text-xs font-bold
                           hover:bg-rose/10 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download QR Code (PNG)
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
