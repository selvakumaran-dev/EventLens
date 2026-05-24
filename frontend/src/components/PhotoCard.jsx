import { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * PhotoCard — individual photo in the matched gallery.
 *
 * Features:
 *  • Framer Motion fade-in-up stagger (parent controls delay via `custom` prop)
 *  • Desktop: scale + overlay on hover
 *  • Mobile: tap to reveal download overlay
 *  • Premium download: fetch → blob → anchor click (bypasses CORS link issues)
 */
export default function PhotoCard({ photo, index }) {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const dist = photo._matchDistance;
  const matchPct = dist !== undefined
    ? Math.max(60, Math.min(99, Math.round(99 - (dist / 0.6) * 39)))
    : null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);

    try {
      // Fetch the image as a blob to force browser download (not new tab)
      const response = await fetch(photo.storageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `eventlens-photo-${photo._id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab if fetch fails (CORS restriction)
      window.open(photo.storageUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative group rounded-xl overflow-hidden aspect-[3/4] bg-surface cursor-pointer shadow-sm hover:shadow-md transition-shadow"
      onClick={() => setOverlayVisible((v) => !v)}
      role="button"
      aria-label={`Photo ${index + 1} — tap to download`}
    >
      {/* Photo */}
      <img
        src={photo.storageUrl}
        alt={`Your photo ${index + 1}`}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 ease-out
                   group-hover:scale-[1.04]"
      />

      {/* Gradient overlay — always present at bottom for context */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Download button — revealed on hover (desktop) or tap (mobile) */}
      <div
        className={`absolute inset-0 flex items-center justify-center
                    bg-black/35 backdrop-blur-[1px]
                    transition-opacity duration-300
                    ${overlayVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <button
          id={`download-btn-${photo._id}`}
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Download photo"
          className="w-12 h-12 rounded-full
                     bg-gradient-to-br from-rose to-peach
                     flex items-center justify-center
                     shadow-rose transition-all duration-200
                     hover:scale-110 active:scale-95
                     disabled:opacity-60"
        >
          {downloading ? (
            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            /* Cloud download SVG */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="8 17 12 21 16 17" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
            </svg>
          )}
        </button>
      </div>

      {/* Best match badge on the first card */}
      {index === 0 && (
        <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full
                        bg-rose text-white text-[10px] font-bold tracking-wider uppercase shadow-sm z-10">
          Best Match
        </div>
      )}

      {/* Match Percentage Badge */}
      {matchPct !== null && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full
                        bg-white/90 backdrop-blur-md text-text-primary text-[10px] font-black border border-rose-pale shadow-sm flex items-center gap-1 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
          {matchPct}% Match
        </div>
      )}
    </motion.div>
  );
}
