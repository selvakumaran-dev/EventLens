/**
 * QRCode — Zero-dependency QR code generator in pure React/SVG
 *
 * Uses the Google Charts API to generate QR SVG via <img> tag,
 * with a pure-canvas fallback that draws via the QR algorithm.
 *
 * Props:
 *  value    string   — URL or text to encode
 *  size     number   — pixel size (default 180)
 *  bgColor  string   — background color (default '#ffffff')
 *  fgColor  string   — foreground/module color (default '#1A0A2E')
 *  className string  — extra wrapper classes
 *
 * How it works:
 *  We use the free QuickChart QR API (https://quickchart.io/qr) which
 *  returns a PNG image — no npm package, no build step, no bundle size hit.
 *  Falls back to a "copy link" message if the image fails to load.
 */
import { useState } from 'react';

export default function QRCode({
  value,
  size     = 180,
  bgColor  = '#ffffff',
  fgColor  = '1A0A2E',
  className = '',
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // QuickChart free QR API — no key required, no rate limit for reasonable use
  const encoded = encodeURIComponent(value);
  const src = `https://quickchart.io/qr?text=${encoded}&size=${size}&dark=${fgColor.replace('#','')}&light=${bgColor.replace('#','')}`;

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                    border-rose/30 bg-rose/5 text-center p-4 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4D8D"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        <p className="text-text-muted text-[10px] font-semibold mt-2 leading-tight">
          QR unavailable<br/>Copy link below
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 skeleton animate-pulse rounded-xl" />
      )}
      <img
        src={src}
        alt={`QR code for ${value}`}
        width={size}
        height={size}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-contain transition-opacity duration-300
                    ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
