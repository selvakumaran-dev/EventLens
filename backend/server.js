import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import adminRouter from './routes/admin.js';
import guestRouter from './routes/guest.js';

// ── BUG-01: Guard against weak / default JWT secret in production ─────────────
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET.includes('change_this') ||
    process.env.JWT_SECRET.includes('secret') ||
    process.env.JWT_SECRET.length < 32)
) {
  console.error('❌  FATAL: JWT_SECRET is missing, too short, or uses the default placeholder value.');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// ── Connect to MongoDB Atlas ─────────────────────────────────────────────────
await connectDB();

const app = express();

// ── BUG-03: HTTP Security Headers via inline middleware (no helmet dep needed) ─
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Trust proxy (crucial for accurate rate limiting when deployed behind Render's load balancer)
app.set('trust proxy', 1);

// Parse the comma-separated ALLOWED_ORIGINS env var for multi-origin support
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ── BUG-04: Fixed CORS — null-origin bypass only allowed in development ────────
app.use(
  cors({
    origin: (origin, callback) => {
      // BUG-04 FIX: Only allow no-origin requests in development (Postman, curl etc.)
      // In production, all requests MUST have an Origin header that matches whitelist
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      if (origin && allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }

      if (origin) {
        console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      }
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
  // BUG-13 FIX: Only log sensitive infra details in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`    Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`    Allowed origins: ${allowedOrigins.join(', ') || '(all — dev mode)'}`);
  }
});
