/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Celebration Bloom Palette ─────────────────────────────────────────
      colors: {
        canvas: '#FDF4FF',
        surface: '#FFFFFF',
        'surface-pink': '#FFF0F8',
        rose: {
          DEFAULT: '#FF4D8D',
          light:   '#FF8DB4',
          pale:    '#FFD6E8',
          deep:    '#E8356D',
          glow:    'rgba(255,77,141,0.25)',
        },
        peach: {
          DEFAULT: '#FF8C61',
          light:   '#FFCDB8',
          pale:    '#FFF0EA',
        },
        gold: {
          DEFAULT: '#FFB830',
          light:   '#FFE4A0',
          dark:    '#E89A10',
          glow:    'rgba(255,184,48,0.3)',
        },
        lavender: {
          DEFAULT: '#9B6EE8',
          light:   '#E4D4FF',
          pale:    '#F5F0FF',
        },
        text: {
          primary: '#1A0A2E',
          muted:   '#8B6FA0',
          subtle:  '#C4A8D8',
        },
      },

      // ── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },

      // ── Custom Animations ─────────────────────────────────────────────────
      keyframes: {
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'laser-scan': {
          '0%':  { top: '0%',   opacity: '1' },
          '85%': { opacity: '1' },
          '100%':{ top: '100%', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'gradient-shift': {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'confetti-fall': {
          '0%':   { transform: 'translateY(-20px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        'pop-in': {
          '0%':   { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '60%':  { transform: 'scale(1.15) rotate(3deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'pulse-rose': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,77,141,0.4)' },
          '50%':      { boxShadow: '0 0 0 12px rgba(255,77,141,0)' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.3)', opacity: '0' },
          '50%':  { transform: 'scale(1.05)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in-up':      'fade-in-up 0.5s ease-out both',
        'fade-in':         'fade-in 0.4s ease-out both',
        'scale-in':        'scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        shimmer:           'shimmer 1.8s linear infinite',
        'laser-scan':      'laser-scan 2s ease-in-out infinite',
        float:             'float 5s ease-in-out infinite',
        'gradient-shift':  'gradient-shift 12s ease infinite',
        'confetti-fall':   'confetti-fall linear forwards',
        'pop-in':          'pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-rose':      'pulse-rose 2s ease-in-out infinite',
        'spin-slow':       'spin-slow 8s linear infinite',
        'bounce-in':       'bounce-in 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
      },

      boxShadow: {
        rose:       '0 8px 30px rgba(255,77,141,0.25)',
        'rose-lg':  '0 16px 50px rgba(255,77,141,0.35)',
        peach:      '0 8px 30px rgba(255,140,97,0.25)',
        card:       '0 4px 24px rgba(255,77,141,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
        'card-lg':  '0 8px 40px rgba(255,77,141,0.12)',
      },
    },
  },
  plugins: [],
};
