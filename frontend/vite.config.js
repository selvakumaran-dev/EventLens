import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Automatic PWA Logo copy on boot
try {
  const sourcePath = 'C:\\Users\\god\\.gemini\\antigravity\\brain\\8bcd7303-e243-414a-a59d-1de087f0dabb\\eventlens_logo_icon_1779442480485.png';
  const targetDir = 'C:\\EventLens\\frontend\\public';
  if (fs.existsSync(sourcePath)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, path.join(targetDir, 'logo.png'));
    fs.copyFileSync(sourcePath, path.join(targetDir, 'logo192.png'));
    fs.copyFileSync(sourcePath, path.join(targetDir, 'logo512.png'));
    console.log('✅ PWA Setup: Successfully copied brand logos to frontend/public');
  } else {
    console.warn('⚠️ PWA Setup: Logo source path not found at ' + sourcePath);
  }
} catch (err) {
  console.error('❌ PWA Setup: Error copying logos:', err);
}

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
