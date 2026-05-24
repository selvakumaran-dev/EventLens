import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

/**
 * CameraViewport
 * ──────────────────────────────────────────────────────────────────────────
 * Renders a circular camera preview with:
 *  • Front-facing camera via getUserMedia (iOS playsinline fix)
 *  • Abstract SVG face-alignment guide overlay
 *  • Rose border + glow ring
 *  • Fallback to file input if camera permission denied
 *
 * Exposes a ref handle:
 *  • ref.captureFrame() → returns an HTMLCanvasElement with the current frame
 *  • ref.videoElement   → the raw HTMLVideoElement
 */
const CameraViewport = forwardRef(function CameraViewport({ onFrame, capturePhase }, ref) {
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const fileInputRef = useRef(null);
  const uploadedImageRef = useRef(null);
  const [cameraError,  setCameraError]  = useState(null);
  const [cameraReady,  setCameraReady]  = useState(false);
  const [usingFile,    setUsingFile]    = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState(null);

  // Shift landmark guides to guide the user's face position
  const guideCx = capturePhase === 'left' ? 122 : capturePhase === 'right' ? 158 : 140;

  // Cleanup preview URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Start camera stream
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width:  { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch (err) {
        console.warn('Camera access denied:', err.message);
        setCameraError('Camera access was denied. Please upload a selfie instead.');
        setUsingFile(true);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Expose captureFrame() to parent via ref
  useImperativeHandle(ref, () => ({
    captureFrame() {
      if (usingFile) {
        if (!uploadedImageRef.current) return null;
        const img = uploadedImageRef.current;
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || img.width  || 640;
        canvas.height = img.naturalHeight || img.height || 640;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return canvas;
      }
      if (!videoRef.current || !cameraReady) return null;

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 640;
      canvas.getContext('2d').drawImage(video, 0, 0);
      return canvas;
    },
    get videoElement() { return videoRef.current; },
  }), [cameraReady, usingFile]);

  // File input fallback handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    const img = new Image();
    img.src = url;
    img.onload = () => {
      uploadedImageRef.current = img;
      if (onFrame) onFrame(img);
    };
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* ── Circular camera container ─────────────────────────────────────── */}
      <div className="relative">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full animate-glow-breathe pointer-events-none"
          style={{ boxShadow: '0 0 50px rgba(255, 77, 141, 0.35)', borderRadius: '9999px' }}
        />

        {/* Rose border ring */}
        <div
          className="relative w-[280px] h-[280px] rounded-full overflow-hidden
                     border-2 border-rose shadow-rose"
        >
          {/* Live camera video */}
          {!usingFile && (
            <video
              ref={videoRef}
              id="camera-feed"
              className="w-full h-full object-cover scale-x-[-1]" // Mirror the front cam
              autoPlay
              playsInline    // Required for iOS
              muted
              aria-label="Camera preview"
            />
          )}

          {/* File upload preview */}
          {usingFile && previewUrl && (
            <img
              src={previewUrl}
              alt="Selfie preview"
              className="w-full h-full object-cover"
            />
          )}

          {/* Placeholder while loading */}
          {!cameraReady && !usingFile && (
            <div className="w-full h-full flex items-center justify-center bg-white/80">
              <div className="w-8 h-8 rounded-full border-2 border-rose-pale border-t-rose animate-spin" />
            </div>
          )}

          {/* ── Face alignment SVG overlay ──────────────────────────────── */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 280 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Inline floating animations for side profile arrows */}
            <style>{`
              @keyframes float-left {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(-8px); }
              }
              @keyframes float-right {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(8px); }
              }
              .animate-float-left {
                animation: float-left 1.2s ease-in-out infinite;
              }
              .animate-float-right {
                animation: float-right 1.2s ease-in-out infinite;
              }
            `}</style>

            {/* Oval face guide */}
            <ellipse
              cx={guideCx} cy="130"
              rx="62" ry="78"
              stroke="rgba(255, 77, 141, 0.45)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              style={{ transition: 'cx 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
            {/* Brow line */}
            <path 
              d={`M${guideCx - 30} 108 Q${guideCx - 15} 102 ${guideCx} 108 Q${guideCx + 15} 102 ${guideCx + 30} 108`}
              stroke="rgba(255, 77, 141, 0.3)" strokeWidth="1.2" strokeLinecap="round"
              style={{ transition: 'd 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
            {/* Eye markers */}
            <ellipse cx={guideCx - 20} cy="122" rx="9" ry="5" stroke="rgba(255, 77, 141, 0.3)" strokeWidth="1" style={{ transition: 'cx 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            <ellipse cx={guideCx + 20} cy="122" rx="9" ry="5" stroke="rgba(255, 77, 141, 0.3)" strokeWidth="1" style={{ transition: 'cx 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            {/* Nose bridge */}
            <path 
              d={`M${guideCx} 115 L${guideCx - 5} 148 Q${guideCx} 152 ${guideCx + 5} 148`}
              stroke="rgba(255, 77, 141, 0.25)" strokeWidth="1.2" strokeLinecap="round"
              style={{ transition: 'd 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
            {/* Mouth */}
            <path 
              d={`M${guideCx - 18} 162 Q${guideCx} 172 ${guideCx + 18} 162`}
              stroke="rgba(255, 77, 141, 0.3)" strokeWidth="1.2" strokeLinecap="round"
              style={{ transition: 'd 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
            {/* Chin point */}
            <line 
              x1={guideCx} y1="195" x2={guideCx} y2="205"
              stroke="rgba(255, 77, 141, 0.25)" strokeWidth="1" strokeLinecap="round"
              style={{ transition: 'x1 0.4s, x2 0.4s' }}
            />

            {/* Turn Left Arrow Indicator */}
            {capturePhase === 'left' && (
              <g className="animate-float-left">
                <path d="M60 130 L35 130 M45 120 L35 130 L45 140" stroke="#FF4D8D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="35" cy="130" r="5" fill="#FF4D8D" opacity="0.7" />
              </g>
            )}

            {/* Turn Right Arrow Indicator */}
            {capturePhase === 'right' && (
              <g className="animate-float-right">
                <path d="M220 130 L245 130 M235 120 L245 130 L235 140" stroke="#FF4D8D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="245" cy="130" r="5" fill="#FF4D8D" opacity="0.7" />
              </g>
            )}

            {/* Corner alignment marks */}
            <path d="M90 90 L80 90 L80 100" stroke="rgba(255, 77, 141, 0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M190 90 L200 90 L200 100" stroke="rgba(255, 77, 141, 0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M90 190 L80 190 L80 180" stroke="rgba(255, 77, 141, 0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M190 190 L200 190 L200 180" stroke="rgba(255, 77, 141, 0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── Error & fallback ──────────────────────────────────────────────── */}
      {cameraError && (
        <div className="text-center space-y-3">
          <p className="text-xs text-text-muted px-4 max-w-[260px] font-semibold">{cameraError}</p>
          <button
            id="upload-selfie-btn"
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost text-sm font-semibold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Selfie
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileSelect}
            id="selfie-file-input"
          />
        </div>
      )}
    </div>
  );
});

export default CameraViewport;
