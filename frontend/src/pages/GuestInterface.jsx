import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import { loadGuestModels, extractSingleDescriptor } from '../utils/faceApiLoader.js';
import { averageDescriptors, findMatchingPhotosAsync } from '../utils/faceMatching.js';
import CameraViewport from '../components/CameraViewport.jsx';
import PhotoCard from '../components/PhotoCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Logo from '../components/Logo.jsx';

// Custom inline Canvas Confetti component for celebratory feedback
function ConfettiEffect({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = ['#FF4D8D', '#FF8C61', '#FFB830', '#9B6EE8', '#FF8DB4', '#FFE4A0'];
    const particleCount = 120;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 5 + 3,
        d: Math.random() * particleCount,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.08 + 0.03,
        tiltAngle: 0,
        speed: Math.random() * 3.5 + 2.5,
      });
    }

    let startTime = Date.now();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Animation lasts 4 seconds
      if (Date.now() - startTime > 4000) {
        cancelAnimationFrame(animationFrameId);
        return;
      }

      particles.forEach((p) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += p.speed;
        p.x += Math.sin(p.tiltAngle) * 0.6;
        p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}

// How many selfie frames to capture and average for accuracy
const CAPTURE_FRAMES = 3;
const CAPTURE_DELAY_MS = 400; // ms between frames

const STATE = {
  LOADING:    'LOADING',
  READY:      'READY',
  CAPTURING:  'CAPTURING',  // Collecting multiple frames
  SCANNING:   'SCANNING',   // Running face-api.js
  RESULTS:    'RESULTS',
  NO_FACE:    'NO_FACE',
  ERROR:      'ERROR',
};

export default function GuestInterface() {
  const { eventId } = useParams();
  const navigate    = useNavigate();
  const { eventInfo, logoutGuest } = useAuth();

  const cameraRef     = useRef(null);
  const photoCacheRef = useRef([]);

  const [scanState,      setScanState]      = useState(STATE.LOADING);
  const [modelsReady,    setModelsReady]    = useState(false);
  const [vectorsReady,   setVectorsReady]   = useState(false);
  const [matchedPhotos,  setMatchedPhotos]  = useState({ strict: [], loose: [], all: [] });
  const [errorMsg,       setErrorMsg]       = useState('');
  const [photoCount,     setPhotoCount]     = useState(0);
  const [captureStep,    setCaptureStep]    = useState(0);  // 0–CAPTURE_FRAMES
  const [showConfetti,   setShowConfetti]   = useState(false);
  const [zipping,        setZipping]        = useState(false);
  const [zipProgress,    setZipProgress]    = useState('');
  const [zipWarning,     setZipWarning]     = useState('');

  // 3-Angle biometric scanning state variables
  const [capturePhase,    setCapturePhase]    = useState('front'); // 'front' | 'left' | 'right'
  const [capturedAngles,   setCapturedAngles]   = useState([]); // ['front', 'left', 'right']
  const [flashActive,      setFlashActive]      = useState(false);
  const capturedDescriptorsRef = useRef([]);

  // Match Sensitivity States
  const [looseThreshold, setLooseThreshold] = useState(0.60); // 0.50 (Strict) | 0.60 (Balanced)
  const [capturedDescriptors, setCapturedDescriptors] = useState(null);

  // ── Step 1: Load models + fetch vectors concurrently ─────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const [, vectorRes] = await Promise.all([
          loadGuestModels().then(() => { if (!cancelled) setModelsReady(true); }),
          api.get(`/api/guest/event-vectors/${eventId}`),
        ]);

        if (cancelled) return;
        photoCacheRef.current = vectorRes.data.photos;
        setPhotoCount(vectorRes.data.photoCount);
        setVectorsReady(true);
        setScanState(STATE.READY);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Failed to load event data.');
          setScanState(STATE.ERROR);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [eventId]);

  // Dynamic face matching filter based on current threshold
  useEffect(() => {
    if (!capturedDescriptors || !photoCacheRef.current.length) return;

    let active = true;
    const runFilter = async () => {
      try {
        const matches = await findMatchingPhotosAsync(
          capturedDescriptors,
          photoCacheRef.current,
          0.45,           // strict threshold
          looseThreshold  // dynamic loose threshold
        );
        if (!active) return;
        setMatchedPhotos(matches);
        
        // Show confetti only on the initial scan completion
        if (scanState === STATE.SCANNING) {
          if (matches.all.length > 0) {
            setShowConfetti(true);
          }
        }
        setScanState(STATE.RESULTS);
      } catch (err) {
        if (active) {
          setErrorMsg(err.message || 'Face analysis failed.');
          setScanState(STATE.ERROR);
        }
      }
    };

    runFilter();
    return () => { active = false; };
  }, [capturedDescriptors, looseThreshold]);

  const runVectorSearchAndMatch = async () => {
    setScanState(STATE.SCANNING);
    // Setting this state triggers the matching useEffect above
    setCapturedDescriptors([...capturedDescriptorsRef.current]);
  };

  // Failsafe: manual skip override to process whatever has been successfully captured
  const handleSkipAngle = useCallback(async () => {
    if (capturedDescriptorsRef.current.length === 0) {
      setScanState(STATE.NO_FACE);
      return;
    }
    await runVectorSearchAndMatch();
  }, []);

  // ── Step 2: Multi-frame guided 3-angle capture → match ─────────────────────────
  const handleScan = useCallback(async () => {
    if (scanState !== STATE.READY) return;

    setScanState(STATE.CAPTURING);
    setCapturePhase('front');
    setCapturedAngles([]);
    setFlashActive(false);
    setShowConfetti(false);
    capturedDescriptorsRef.current = [];

    const phases = ['front', 'left', 'right'];

    for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
      const currentPhase = phases[phaseIdx];
      setCapturePhase(currentPhase);

      // Wait a transition buffer so the user has time to orient their head
      const delay = phaseIdx === 0 ? 500 : 1400;
      await new Promise((r) => setTimeout(r, delay));

      // Attempt to capture a valid face descriptor at this angle (up to 3 retries)
      let descriptor = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const frame = cameraRef.current?.captureFrame();
        if (!frame) break;

        try {
          descriptor = await extractSingleDescriptor(frame);
          if (descriptor) break; // Found a face!
        } catch (err) {
          console.warn(`Attempt ${attempt + 1} at ${currentPhase} failed:`, err.message);
        }
        await new Promise((r) => setTimeout(r, 200)); // Short retry delay
      }

      if (descriptor) {
        // Successful capture!
        capturedDescriptorsRef.current.push(descriptor);
        setCapturedAngles((prev) => [...prev, currentPhase]);
        
        // Trigger a green success flash around the viewport
        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 400);

        // Success sound chime mock / haptic vibration API
        if (navigator.vibrate) navigator.vibrate(40);
      } else {
        console.warn(`Could not capture face descriptor for angle: ${currentPhase}`);
        // If front fails, we immediately drop to no face detected because it is the baseline
        if (currentPhase === 'front') {
          setScanState(STATE.NO_FACE);
          return;
        }
      }
    }

    // After all phases, check if we have at least 1 successful descriptor
    if (capturedDescriptorsRef.current.length === 0) {
      setScanState(STATE.NO_FACE);
      return;
    }

    await runVectorSearchAndMatch();
  }, [scanState]);

  const handleRescan = () => {
    setMatchedPhotos({ strict: [], loose: [], all: [] });
    setCaptureStep(0);
    setCapturePhase('front');
    setCapturedAngles([]);
    setFlashActive(false);
    setShowConfetti(false);
    capturedDescriptorsRef.current = [];
    setCapturedDescriptors(null);
    setScanState(STATE.READY);
  };

  const handleLogout = () => {
    logoutGuest();
    navigate(`/event/${eventId}`);
  };

  const handleDownloadAll = async (photos) => {
    if (photos.length === 0) return;
    setZipping(true);
    setZipProgress('Initializing ZIP engine...');
    setZipWarning('');
    try {
      if (!window.JSZip) {
        await new Promise((res, rej) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
          script.onload = res;
          script.onerror = rej;
          document.head.appendChild(script);
        });
      }
      
      const zip = new window.JSZip();
      let failedCount = 0;
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setZipProgress(`Downloading photo ${i + 1} of ${photos.length}...`);
        
        try {
          const response = await fetch(photo.storageUrl);
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const blob = await response.blob();
          zip.file(`eventlens-photo-${photo._id || i + 1}.jpg`, blob);
        } catch (fetchErr) {
          console.warn(`⚠️ Failed to download photo ${photo._id || i + 1} for ZIP:`, fetchErr.message);
          failedCount++;
        }
      }

      if (failedCount === photos.length) {
        throw new Error('All photo downloads failed. Please check your internet connection.');
      }
      
      setZipProgress('Generating ZIP package...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      setZipProgress('Triggering download...');
      const link = document.createElement('a');
      const url = URL.createObjectURL(content);
      link.href = url;
      link.download = `eventlens-${eventInfo?.eventName || 'event'}-photos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setZipProgress('');
      if (failedCount > 0) {
        setZipWarning(`✓ Download complete, but ${failedCount} photo(s) couldn't be included due to network or Cloudinary errors.`);
      }
    } catch (err) {
      console.error('ZIP compilation failed:', err);
      setZipWarning(`❌ Failed to compile ZIP: ${err.message}`);
    } finally {
      setZipping(false);
    }
  };

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const renderLoading = () => (
    <div className="flex flex-col items-center gap-5 py-16">
      <LoadingSpinner size="lg" />
      <div className="text-center space-y-1.5">
        <p className="text-text-muted text-sm font-semibold animate-pulse">
          {!modelsReady ? 'Loading Face AI models…' : !vectorsReady ? 'Fetching event photos…' : 'Almost ready…'}
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-text-subtle font-medium">
          <span className={modelsReady ? 'text-rose font-bold' : ''}>
            {modelsReady ? '✓' : '○'} Face AI
          </span>
          <span className={vectorsReady ? 'text-rose font-bold' : ''}>
            {vectorsReady ? '✓' : '○'} {photoCount > 0 ? `${photoCount} photos` : 'Event data'}
          </span>
        </div>
      </div>
    </div>
  );

  const renderWorkspace = () => {
    return (
      <div className="flex flex-col items-center gap-7 pt-8 pb-12 px-4 relative">
        <div className="ambient-glow w-[350px] h-[350px] top-0 left-1/2 -translate-x-1/2 opacity-35" />

        {/* Dynamic header/instruction based on current state */}
        <div className="text-center space-y-2 h-[80px] flex flex-col justify-center">
          {scanState === STATE.READY && (
            <>
              <h2 className="heading-serif text-2xl text-rose-gradient">Find Your Photos</h2>
              <p className="text-text-muted text-xs max-w-[280px] mx-auto font-medium">
                Center your face in the circle. We'll guide you through a{' '}
                <span className="text-rose font-semibold">3-angle biometric scan</span> (Front, Left, Right).
              </p>
            </>
          )}
          {scanState === STATE.CAPTURING && (
            <div className="space-y-1 animate-fade-in">
              <h2 className="heading-serif text-2xl text-rose">
                {capturePhase === 'front' && 'Step 1: Look Front'}
                {capturePhase === 'left' && 'Step 2: Turn Left 3/4'}
                {capturePhase === 'right' && 'Step 3: Turn Right 3/4'}
              </h2>
              <p className="text-text-muted text-xs font-semibold">
                {capturePhase === 'front' && 'Center your face and look straight into the camera.'}
                {capturePhase === 'left' && 'Tilt your head slightly to the left side.'}
                {capturePhase === 'right' && 'Tilt your head slightly to the right side.'}
              </p>
            </div>
          )}
          {scanState === STATE.SCANNING && (
            <div className="space-y-1 animate-pulse">
              <h2 className="heading-serif text-2xl text-peach">Analyzing Face Angles…</h2>
              <p className="text-text-muted text-xs font-semibold">
                Performing multi-angle biometric search...
              </p>
            </div>
          )}
        </div>

        {/* Circular camera feed with active state overlays */}
        <div className="relative">
          <CameraViewport ref={cameraRef} capturePhase={scanState === STATE.CAPTURING ? capturePhase : null} />
          
          {/* Laser sweep overlay during active scanning */}
          {scanState === STATE.SCANNING && (
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none w-[280px] h-[280px] border-2 border-transparent mx-auto">
              <div className="absolute left-0 right-0 h-[3px] bg-rose animate-laser-scan"
                style={{ boxShadow: '0 0 12px #FF4D8D, 0 0 24px rgba(255,77,141,0.6)' }} />
            </div>
          )}

          {/* Capture transition flash overlay */}
          <AnimatePresence>
            {flashActive && (
              <motion.div
                initial={{ opacity: 0.8, scale: 0.95 }}
                animate={{ opacity: 0, scale: 1.05 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 rounded-full border-4 border-emerald-500 pointer-events-none w-[280px] h-[280px] mx-auto shadow-[0_0_30px_rgba(16,185,129,0.6)]"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="w-full flex flex-col items-center gap-3">
          {scanState === STATE.READY && (
            <button
              id="scan-face-btn"
              onClick={handleScan}
              className="btn-rose text-base px-10 shadow-rose font-bold"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              Start 3-Angle Scan
            </button>
          )}

          {scanState === STATE.CAPTURING && (
            <div className="flex flex-col items-center gap-3 w-full">
              {/* Step indicator bubbles */}
              <div className="flex items-center justify-center gap-4">
                <span className={`text-xs px-3 py-1 rounded-full font-bold transition-all duration-300 ${
                  capturePhase === 'front' 
                    ? 'bg-rose text-white shadow-rose scale-110' 
                    : capturedAngles.includes('front')
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-white/80 text-text-subtle border border-rose-pale'
                }`}>
                  {capturedAngles.includes('front') ? '✓ Front' : '1. Front'}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-bold transition-all duration-300 ${
                  capturePhase === 'left' 
                    ? 'bg-rose text-white shadow-rose scale-110' 
                    : capturedAngles.includes('left')
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-white/80 text-text-subtle border border-rose-pale'
                }`}>
                  {capturedAngles.includes('left') ? '✓ Left' : '2. Left'}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-bold transition-all duration-300 ${
                  capturePhase === 'right' 
                    ? 'bg-rose text-white shadow-rose scale-110' 
                    : capturedAngles.includes('right')
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-white/80 text-text-subtle border border-rose-pale'
                }`}>
                  {capturedAngles.includes('right') ? '✓ Right' : '3. Right'}
                </span>
              </div>

              {/* Skip or fail-safes */}
              <button 
                onClick={handleSkipAngle}
                className="text-xs text-text-muted hover:text-rose transition-colors underline font-semibold mt-1 font-sans"
              >
                Skip current angle & scan
              </button>
            </div>
          )}

          {scanState === STATE.SCANNING && (
            <p className="text-rose text-sm font-semibold animate-pulse tracking-wide mt-2">
              Cross-matching all angles against {photoCount} photos…
            </p>
          )}

          {scanState === STATE.READY && photoCount > 0 && (
            <p className="text-text-muted text-xs font-semibold">
              Searching across <span className="text-rose">{photoCount} photos</span> including group shots
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderNoFace = () => (
    <div className="flex flex-col items-center gap-6 py-16 text-center px-6 glass-card mx-4 mt-6">
      <div className="w-16 h-16 rounded-full bg-rose-pale flex items-center justify-center text-3xl animate-bounce">😶</div>
      <div className="space-y-2">
        <p className="text-text-primary font-bold text-lg">No face detected</p>
        <ul className="text-text-muted text-xs space-y-1.5 text-left max-w-[260px] font-medium">
          <li>• Face your front camera directly</li>
          <li>• Make sure you're in good light</li>
          <li>• Remove sunglasses or face coverings</li>
          <li>• Move slightly closer to the camera</li>
        </ul>
      </div>
      <button id="retry-scan-btn" onClick={handleRescan} className="btn-rose px-8 font-bold">Try Again</button>
    </div>
  );

  const renderResults = () => {
    const { strict, loose, all } = matchedPhotos;

    return (
      <div className="w-full space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2">
          <div>
            <h2 className="text-text-primary font-bold text-lg">
              {all.length > 0
                ? `${all.length} photo${all.length !== 1 ? 's' : ''} found`
                : 'No matches found'}
            </h2>
            {all.length > 0 && (
              <p className="text-text-muted text-xs mt-0.5 font-medium">
                <span className="text-rose font-bold">{strict.length} confident</span> match{strict.length !== 1 ? 'es' : ''}
                {loose.length > 0 && (
                  <> and <span className="text-text-primary font-bold">{loose.length} possible</span> match{loose.length !== 1 ? 'es' : ''}</>
                )}
                {' · Tap to download'}
              </p>
            )}
          </div>
          <button onClick={handleRescan} className="btn-ghost text-xs px-4 py-2 font-semibold">Re-scan</button>
        </div>

        {/* Sensitivity Selector */}
        <div className="mx-4 p-4 rounded-2xl border border-rose-pale bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-text-primary text-[10px] sm:text-xs font-bold uppercase tracking-wider">Search Sensitivity</span>
            <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose/10 text-rose">
              {looseThreshold === 0.50 ? 'Strict' : 'Balanced (Default)'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLooseThreshold(0.60)}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl border transition-all duration-200 ${
                looseThreshold === 0.60
                  ? 'bg-rose text-white border-rose shadow-sm shadow-rose/20'
                  : 'bg-canvas text-text-muted border-rose-pale hover:border-rose/25'
              }`}
            >
              Balanced Mode
            </button>
            <button
              onClick={() => setLooseThreshold(0.50)}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-xl border transition-all duration-200 ${
                looseThreshold === 0.50
                  ? 'bg-rose text-white border-rose shadow-sm shadow-rose/20'
                  : 'bg-canvas text-text-muted border-rose-pale hover:border-rose/25'
              }`}
            >
              Strict Mode (Only Me)
            </button>
          </div>
          <p className="text-[10px] text-text-muted font-semibold leading-relaxed">
            {looseThreshold === 0.60
              ? '⚖️ Balanced: Recommended setting. Best trade-off between capturing natural poses and keeping other people out.'
              : '🔒 Strict: Filters out any potential lookalikes. Shows only clear, front-facing matches of you.'}
          </p>
        </div>

        {/* Zip Warning / Success Banners */}
        {zipWarning && (
          <div className={`mx-4 p-3 rounded-xl border text-xs font-semibold text-center ${
            zipWarning.startsWith('❌') 
              ? 'bg-red-500/10 border-red-500/20 text-red-600' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
          }`}>
            {zipWarning}
          </div>
        )}

        {/* Dynamic ZIP Batch Download and Progress */}
        {zipping && (
          <div className="mx-4 p-4 rounded-xl bg-rose-pale/40 border border-rose-pale/60 flex flex-col gap-2 items-center text-center animate-pulse">
            <div className="w-5 h-5 rounded-full border-2 border-rose/30 border-t-rose animate-spin" />
            <p className="text-xs text-rose font-bold tracking-wide">{zipProgress}</p>
          </div>
        )}

        {all.length > 0 && !zipping && (
          <div className="px-4">
            <button
              onClick={() => handleDownloadAll(all)}
              className="btn-rose w-full text-sm py-3 shadow-rose font-bold flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download All My Photos ({all.length})
            </button>
          </div>
        )}

        {all.length > 0 ? (
          <div className="space-y-6 px-4 pb-12">
            {/* Confident matches */}
            {strict.length > 0 && (
              <div className="space-y-3">
                {loose.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-rose-pale" />
                    <span className="text-[10px] text-rose tracking-wider uppercase font-bold px-2">
                      Your Photos
                    </span>
                    <div className="h-px flex-1 bg-rose-pale" />
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {strict.map((photo, index) => (
                      <PhotoCard key={photo._id} photo={photo} index={index} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Possible matches (e.g. group photos, side profiles) */}
            {loose.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-rose-pale" />
                  <span className="text-[10px] text-text-muted tracking-wider uppercase font-bold px-2">
                    Possible Matches
                  </span>
                  <div className="h-px flex-1 bg-rose-pale" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {loose.map((photo, index) => (
                      <PhotoCard key={photo._id} photo={photo} index={strict.length + index} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState onRescan={handleRescan} />
        )}
      </div>
    );
  };

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas flex flex-col relative overflow-x-hidden">
      
      {/* Celebration Confetti burst layer */}
      <ConfettiEffect active={showConfetti} />

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-rose-pale/40 z-20
                         sticky top-0 bg-canvas/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Logo variant="wordmark" size="sm" />
          {eventInfo?.eventName && (
            <span className="text-text-muted text-[10px] truncate max-w-[85px] sm:max-w-[150px] font-semibold
                             border-l border-lavender-light pl-2 ml-1"
                  title={eventInfo.eventName}>
              {eventInfo.eventName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Accuracy badge */}
          {scanState === STATE.READY && (
            <div className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20
                            rounded-full px-2 py-0.5 sm:px-2.5 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">High Accuracy Mode</span>
              <span className="inline sm:hidden">High Accuracy</span>
            </div>
          )}
          {scanState === STATE.RESULTS && photoCount > 0 && (
            <span className="text-xs text-text-primary font-bold border border-rose-pale bg-rose-pale/40 rounded-full px-2.5 py-0.5">
              {photoCount} synced
            </span>
          )}
          <button onClick={handleLogout} className="text-text-muted hover:text-rose
                           transition-colors p-2" aria-label="Log out">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto overscroll-none">
        {scanState === STATE.LOADING   && <div className="flex justify-center">{renderLoading()}</div>}
        {(scanState === STATE.READY || scanState === STATE.CAPTURING || scanState === STATE.SCANNING) && renderWorkspace()}
        {scanState === STATE.NO_FACE   && renderNoFace()}
        {scanState === STATE.RESULTS   && <div className="pt-4">{renderResults()}</div>}

        {scanState === STATE.ERROR && (
          <div className="flex flex-col items-center gap-5 px-6 pt-16 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20
                            flex items-center justify-center text-2xl animate-pulse">⚠️</div>
            <div className="space-y-1">
              <p className="text-text-primary font-bold text-lg">Something went wrong</p>
              <p className="text-text-muted text-sm font-semibold">{errorMsg}</p>
            </div>
            <button onClick={() => window.location.reload()} className="btn-rose px-8 font-bold">Reload</button>
          </div>
        )}
      </main>
    </div>
  );
}
