import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import adminRouter from './routes/admin.js';
import guestRouter from './routes/guest.js';
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

// ── Connect to MongoDB Atlas ─────────────────────────────────────────────────
await connectDB();

const app = express();

// Parse the comma-separated ALLOWED_ORIGINS env var for multi-origin support
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl) in dev
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
// Increase limit to 5 MB to accommodate large face descriptor JSON payloads
// (200 photos × 3 faces × 128 floats ≈ ~1.2 MB JSON).
// No binary image data is ever sent to this server.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'EventLens API',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/admin', adminRouter);
app.use('/api/guest', guestRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, () => {
  console.log(`🚀  EventLens API running on http://localhost:${PORT}`);
  console.log(`    Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`    Allowed origins: ${allowedOrigins.join(', ') || '(all)'}`);
});
