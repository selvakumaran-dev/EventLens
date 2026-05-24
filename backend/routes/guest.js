import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
import { verifyGuestToken } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const guestLoginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: 'Too many login attempts. Please try again after 15 minutes.',
});

const guestInfoLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 queries
  message: 'Too many requests for event info. Please try again later.',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/guest/login
//
// Validates the guest's event password and issues a scoped JWT.
// The token encodes ONLY the eventId — the guest can never access
// data from other events even if they tamper with requests.
//
// Request body:
//   { eventId: string, password: string }
//
// Response 200:
//   { success, message, token, event: { _id, eventName, photographerName } }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/login', guestLoginLimiter, async (req, res) => {
  try {
    const { eventId, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!eventId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Both eventId and password are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid eventId format.',
      });
    }

    // ── Lookup event ──────────────────────────────────────────────────────
    const event = await Event.findById(eventId);

    if (!event) {
      // Return 401 (not 404) to avoid leaking whether an event exists
      return res.status(401).json({
        success: false,
        message: 'Invalid event ID or password.',
      });
    }

    // ── Password check (bcrypt compare via model instance method) ─────────
    const isValid = await event.verifyPassword(password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid event ID or password.',
      });
    }

    // ── Issue a scoped guest JWT ───────────────────────────────────────────
    const token = jwt.sign(
      {
        role: 'guest',
        eventId: event._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful. Welcome to EventLens!',
      token,
      event: {
        _id: event._id,
        eventName: event.eventName,
        photographerName: event.photographerName,
      },
    });
  } catch (error) {
    console.error('[POST /api/guest/login]', error);
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/guest/event-vectors/:eventId  [PROTECTED — Guest JWT]
//
// The single most performance-critical endpoint in the system.
// Returns the full face descriptor matrix for a given event so the
// guest's device can perform Euclidean-distance matching locally.
//
// Design choices:
//  • Only _id, storageUrl, and faceDescriptors are sent — no bloat.
//  • Lean query (.lean()) skips Mongoose document hydration for speed.
//  • The eventId in the JWT MUST match the :eventId param — prevents
//    a logged-in guest from pulling another event's photos.
//
// Response 200:
//   {
//     success: true,
//     photoCount: number,
//     photos: [
//       { _id, storageUrl, faceDescriptors: [{ vector: number[] }] },
//       ...
//     ]
//   }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/event-vectors/:eventId', verifyGuestToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // ── Validate param format ─────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid eventId format.',
      });
    }

    // ── Scope enforcement: JWT eventId must match URL param ───────────────
    if (req.guest.eventId !== eventId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to access this event.',
      });
    }

    // ── Fetch photos — lean + projection for maximum throughput ───────────
    const photos = await Photo.find(
      { eventId },
      { _id: 1, storageUrl: 1, faceDescriptors: 1 }  // Explicit projection
    )
      .lean()       // Skip Mongoose hydration — returns plain JS objects ~2× faster
      .sort({ createdAt: -1 });

    // ── Set cache-friendly headers (60s browser cache / 300s CDN cache) ───
    res.set('Cache-Control', 'private, max-age=60');

    return res.status(200).json({
      success: true,
      photoCount: photos.length,
      photos,
    });
  } catch (error) {
    console.error('[GET /api/guest/event-vectors/:eventId]', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching event data.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/guest/event-info/:eventId  [PUBLIC — no auth]
// Returns non-sensitive event metadata (name, photographer) for the
// GuestLogin page greeting — called before the user has a token.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/event-info/:eventId', guestInfoLimiter, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId.' });
    }

    const event = await Event.findById(
      eventId,
      { eventName: 1, photographerName: 1, createdAt: 1 } // No password hash
    ).lean();

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    return res.status(200).json({ success: true, event });
  } catch (error) {
    console.error('[GET /api/guest/event-info/:eventId]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
