import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Photo from '../models/Photo.js';
import Admin from '../models/Admin.js';
import { deleteCloudinaryResources } from '../utils/cloudinaryClient.js';
import { verifyAdminToken } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const adminLoginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many admin login attempts. Please try again after 15 minutes.',
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/admin/login
// Issues a long-lived admin JWT via database authentication
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { adminSecret } = req.body;

    if (!adminSecret) {
      return res.status(400).json({
        success: false,
        message: 'Admin secret is required.',
      });
    }

    const admin = await Admin.findOne({ username: 'admin' });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found.',
      });
    }

    const isValid = await admin.verifyPassword(adminSecret);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials.',
      });
    }

    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Admin authenticated.',
      token,
    });
  } catch (error) {
    console.error('[POST /api/admin/login]', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/admin/change-password  [PROTECTED]
// Securely update the admin password inside the database.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/change-password', verifyAdminToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required.',
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 4 characters long.',
      });
    }

    const admin = await Admin.findOne({ username: 'admin' });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found.',
      });
    }

    const isValid = await admin.verifyPassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    admin.password = newPassword; // Pre-save hook hashes this automatically
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Admin password changed successfully.',
    });
  } catch (error) {
    console.error('[PUT /api/admin/change-password]', error);
    return res.status(500).json({ success: false, message: 'Server error while updating password.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/admin/events  [PROTECTED]
// Create a new event with a name and access password.
// The password is hashed inside the Event model's pre-save hook.
//
// Request body:
//   { eventName: string, eventPassword: string, photographerName?: string }
//
// Response 201:
//   { success, message, event: { _id, eventName, slug, createdAt } }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/events', verifyAdminToken, async (req, res) => {
  try {
    const { eventName, eventPassword, photographerName } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!eventName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'eventName is required.',
      });
    }

    if (!eventPassword || eventPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'eventPassword must be at least 4 characters.',
      });
    }

    // ── Create & save ─────────────────────────────────────────────────────
    const newEvent = await Event.create({
      eventName: eventName.trim(),
      eventPassword,                        // hashed by pre-save hook
      photographerName: photographerName?.trim() || '',
    });

    // ── Return safe projection (no password hash) ─────────────────────────
    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      event: {
        _id: newEvent._id,
        eventName: newEvent.eventName,
        slug: newEvent.slug,
        photographerName: newEvent.photographerName,
        createdAt: newEvent.createdAt,
        // QR-ready guest URL hint (frontend base is configured on the client)
        guestUrl: `/event/${newEvent._id}`,
      },
    });
  } catch (error) {
    console.error('[POST /api/admin/events]', error);
    return res.status(500).json({ success: false, message: 'Server error while creating event.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/admin/upload-metadata  [PROTECTED]
// Bulk-insert photo metadata after the admin panel has already pushed the
// actual image files to Cloudinary directly from the browser.
//
// Zero binary processing happens on this server — only JSON is handled.
//
// Request body:
//   {
//     photos: [
//       {
//         eventId: string,           // MongoDB ObjectId string
//         storageUrl: string,        // Cloudinary secure_url
//         cloudinaryPublicId: string, // (optional) for later deletion
//         faceDescriptors: [         // array of face descriptor vectors
//           { vector: number[] }     // each vector has exactly 128 elements
//         ]
//       },
//       ...
//     ]
//   }
//
// Response 201:
//   { success, message, insertedCount, insertedIds }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/upload-metadata', verifyAdminToken, async (req, res) => {
  try {
    const { photos } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: '`photos` must be a non-empty array.',
      });
    }

    if (photos.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 200 photos per batch. Split into multiple requests.',
      });
    }

    // ── Validate each photo entry ─────────────────────────────────────────
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];

      if (!p.eventId || !mongoose.Types.ObjectId.isValid(p.eventId)) {
        return res.status(400).json({
          success: false,
          message: `photos[${i}].eventId is missing or invalid.`,
        });
      }

      if (!p.storageUrl?.startsWith('https://')) {
        return res.status(400).json({
          success: false,
          message: `photos[${i}].storageUrl must be a valid https:// Cloudinary URL.`,
        });
      }

      // faceDescriptors is optional (no face detected) but must be an array if present
      if (p.faceDescriptors !== undefined && !Array.isArray(p.faceDescriptors)) {
        return res.status(400).json({
          success: false,
          message: `photos[${i}].faceDescriptors must be an array.`,
        });
      }
    }

    // ── Verify the eventId actually exists (use the first one as anchor) ──
    const uniqueEventIds = [...new Set(photos.map((p) => p.eventId))];
    for (const id of uniqueEventIds) {
      const exists = await Event.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: `Event not found: ${id}`,
        });
      }
    }

    // ── Build the documents ───────────────────────────────────────────────
    const photoDocs = photos.map((p) => ({
      eventId: new mongoose.Types.ObjectId(p.eventId),
      storageUrl: p.storageUrl,
      cloudinaryPublicId: p.cloudinaryPublicId || '',
      faceDescriptors: (p.faceDescriptors || []).map((fd) => ({
        // Accept both { vector: [...] } and plain [...] formats from the admin UI
        vector: Array.isArray(fd) ? fd : fd.vector,
      })),
    }));

    // ── Bulk insert (ordered:false → continue on individual doc errors) ───
    const result = await Photo.insertMany(photoDocs, { ordered: false });

    return res.status(201).json({
      success: true,
      message: `${result.length} photo(s) metadata saved successfully.`,
      insertedCount: result.length,
      insertedIds: result.map((doc) => doc._id),
    });
  } catch (error) {
    // Handle partial bulk-insert errors gracefully
    if (error.name === 'BulkWriteError') {
      return res.status(207).json({
        success: false,
        message: 'Partial insert — some documents failed validation.',
        details: error.writeErrors?.map((e) => e.errmsg),
      });
    }

    console.error('[POST /api/admin/upload-metadata]', error);
    return res.status(500).json({ success: false, message: 'Server error during metadata save.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/admin/events  [PROTECTED]
// List all events for the dashboard overview table.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/events', verifyAdminToken, async (req, res) => {
  try {
    const events = await Event.find(
      {},
      { eventPassword: 0 }   // Never return the hashed password
    ).sort({ createdAt: -1 });

    // Enrich with photo count per event
    const enriched = await Promise.all(
      events.map(async (ev) => {
        const photoCount = await Photo.countDocuments({ eventId: ev._id });
        return {
          _id: ev._id,
          eventName: ev.eventName,
          slug: ev.slug,
          photographerName: ev.photographerName,
          createdAt: ev.createdAt,
          photoCount,
          guestUrl: `/event/${ev._id}`,
        };
      })
    );

    return res.status(200).json({ success: true, events: enriched });
  } catch (error) {
    console.error('[GET /api/admin/events]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/admin/events/:eventId  [PROTECTED]
// Remove an event and cascade-delete all its photos.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/events/:eventId', verifyAdminToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid eventId.' });
    }

    // Fetch all photos for this event first to obtain their Cloudinary public IDs
    const photosToDelete = await Photo.find({ eventId }, { cloudinaryPublicId: 1 }).lean();
    const publicIds = photosToDelete
      .map((p) => p.cloudinaryPublicId)
      .filter((id) => id && id.trim() !== '');

    const deleted = await Event.findByIdAndDelete(eventId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Cascade delete metadata from MongoDB
    const { deletedCount } = await Photo.deleteMany({ eventId });

    // Clean up binaries in Cloudinary if any exist
    if (publicIds.length > 0) {
      try {
        await deleteCloudinaryResources(publicIds);
      } catch (cloudinaryErr) {
        console.error('⚠️  Cloudinary asset deletion failed during cascade:', cloudinaryErr.message);
        // We do not block database deletion even if Cloudinary connection fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `Event deleted along with ${deletedCount} associated photo(s) and their Cloudinary storage cleared.`,
    });
  } catch (error) {
    console.error('[DELETE /api/admin/events/:eventId]', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
