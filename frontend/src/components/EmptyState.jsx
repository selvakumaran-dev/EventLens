/**
 * EmptyState — shown when face matching returns zero results.
 * onRescan: callback to trigger a re-scan.
 */
export default function EmptyState({ onRescan }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-12 gap-6 animate-fade-in">
      {/* Illustration */}
      <div className="relative w-24 h-24">
        <div className="ambient-glow w-32 h-32 -top-4 -left-4 opacity-40" />
        <svg
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-24 h-24 animate-float"
        >
          <circle cx="48" cy="48" r="47" stroke="rgba(255, 77, 141, 0.2)" strokeWidth="1" />
          <circle cx="48" cy="48" r="32" stroke="rgba(255, 77, 141, 0.15)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Camera icon */}
          <rect x="26" y="36" width="44" height="32" rx="5" stroke="#FF4D8D" strokeWidth="1.5" opacity="0.6" />
          <circle cx="48" cy="52" r="8" stroke="#FF4D8D" strokeWidth="1.5" opacity="0.6" />
          <path d="M40 36L43 30H53L56 36" stroke="#FF4D8D" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* X mark */}
          <circle cx="68" cy="28" r="10" fill="#FFFFFF" stroke="rgba(255, 77, 141, 0.3)" strokeWidth="1" />
          <path d="M64 24l8 8M72 24l-8 8" stroke="#FF4D8D" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>

      {/* Text */}
      <div className="space-y-2">
        <h3 className="heading-serif text-2xl text-rose-gradient">
          No photos found yet
        </h3>
        <p className="text-text-muted text-sm leading-relaxed max-w-[280px] font-semibold">
          Our photographer is constantly syncing new captures.{' '}
          <span className="text-rose font-bold">Keep celebrating</span> and try scanning
          again in a few minutes!
        </p>
      </div>

      {/* Re-scan CTA */}
      <button
        id="rescan-btn"
        onClick={onRescan}
        className="btn-rose text-sm px-8 font-bold"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Re-scan Face
      </button>
    </div>
  );
}
