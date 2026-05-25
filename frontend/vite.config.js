import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BUG-02 FIX: Removed hardcoded local developer file path (C:\Users\god\...)
// The logo files (logo.png, logo192.png, logo512.png) should be committed
// directly to frontend/public/ — not copied at build-time from a local path.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to backend during development — avoids CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // Ensure face-api.js large WASM/binary assets are handled
  optimizeDeps: {
    exclude: ['@vladmandic/face-api'],
  },
});
