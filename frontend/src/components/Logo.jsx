/**
 * EventLens Logo Component — Option C (EL Monogram Badge)
 * Renders the full horizontal lockup: badge icon + wordmark + tagline
 *
 * Props:
 *  variant  — "full" (icon + text + tagline) | "icon" (badge only) | "wordmark" (text only)
 *  size     — "sm" | "md" | "lg"  (controls overall scale)
 *  className — extra classes on the wrapper
 */
export default function Logo({ variant = 'full', size = 'md', className = '' }) {
  const scales = { sm: 0.65, md: 1, lg: 1.4 };
  const s = scales[size] ?? 1;

  const BadgeIcon = () => (
    <svg
      width={Math.round(44 * s)}
      height={Math.round(44 * s)}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer circle — dark purple ring */}
      <circle cx="22" cy="22" r="21" fill="#FF4D8D" />
      <circle cx="22" cy="22" r="21" stroke="#1A0A2E" strokeWidth="2.5" fill="none" />

      {/* "E" letterform — left block */}
      <rect x="9" y="13" width="3.5" height="18" fill="#1A0A2E" rx="0.5" />
      <rect x="9" y="13" width="11" height="3.5" fill="#1A0A2E" rx="0.5" />
      <rect x="9" y="20.25" width="8.5" height="3.5" fill="#1A0A2E" rx="0.5" />
      <rect x="9" y="27.5" width="11" height="3.5" fill="#1A0A2E" rx="0.5" />

      {/* Aperture iris — center, overlapping E and L */}
      <g transform="translate(18, 17)">
        {/* Aperture blades (6-blade) */}
        <circle cx="5" cy="5" r="5" fill="none" stroke="#1A0A2E" strokeWidth="1.2" />
        {/* Blade 1 */}
        <path d="M5 0 C7 1.5 7 3.5 5 5 C4 3.5 3 1.5 5 0Z" fill="#1A0A2E" />
        {/* Blade 2 */}
        <path d="M10 2.5 C9 4.5 7 5.5 5 5 C5.5 3.5 7 2 10 2.5Z" fill="#1A0A2E" />
        {/* Blade 3 */}
        <path d="M10 7.5 C8 8.5 6 8 5 5 C6.5 5 8.5 5.5 10 7.5Z" fill="#1A0A2E" />
        {/* Blade 4 */}
        <path d="M5 10 C3 8.5 3 6.5 5 5 C6 6.5 7 8.5 5 10Z" fill="#1A0A2E" />
        {/* Blade 5 */}
        <path d="M0 7.5 C1 5.5 3 4.5 5 5 C4.5 6.5 3 8 0 7.5Z" fill="#1A0A2E" />
        {/* Blade 6 */}
        <path d="M0 2.5 C2 1.5 4 2 5 5 C3.5 5 1.5 4.5 0 2.5Z" fill="#1A0A2E" />
        {/* Center hole */}
        <circle cx="5" cy="5" r="1.5" fill="#FF4D8D" />
      </g>

      {/* "L" letterform — right block */}
      <rect x="28.5" y="13" width="3.5" height="18" fill="#1A0A2E" rx="0.5" />
      <rect x="28.5" y="27.5" width="7" height="3.5" fill="#1A0A2E" rx="0.5" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={className} role="img" aria-label="EventLens logo">
        <BadgeIcon />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} role="img" aria-label="EventLens">
      <BadgeIcon />
      {variant !== 'icon' && (
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontSize: Math.round(18 * s),
              fontWeight: 700,
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: '-0.02em',
              color: '#1A0A2E',
            }}
          >
            Event<span style={{ color: '#FF4D8D' }}>Lens</span>
          </div>
          {variant === 'full' && (
            <div
              style={{
                fontSize: Math.round(9 * s),
                fontWeight: 600,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.12em',
                color: '#9B6EE8',
                textTransform: 'uppercase',
                marginTop: Math.round(3 * s),
              }}
            >
              AI · Events · Memories
            </div>
          )}
        </div>
      )}
    </div>
  );
}
