import mongoose from 'mongoose';

/**
 * faceDescriptors: Array of face descriptor vectors.
 * Each vector is a Float32Array of 128 numbers produced by face-api.js
 * (specifically the FaceRecognitionNet model).
 *
 * Schema shape: [[n0, n1, ..., n127], [n0, n1, ..., n127], ...]
 *   • Outer array  → multiple faces detected in the same photo
 *   • Inner array  → 128-float Euclidean descriptor for one face
 *
 * Stored as plain Number arrays so MongoDB can handle them without
 * binary serialization — the JSON payload from the admin browser maps
 * directly onto this schema.
 */
const faceDescriptorSchema = new mongoose.Schema(
  {
    // 128-element float vector from face-api.js FaceRecognitionNet
    vector: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => arr.length === 128,
        message: 'Each face descriptor must contain exactly 128 float values.',
      },
    },
  },
  { _id: false } // Sub-documents don't need their own _id
);

const photoSchema = new mongoose.Schema(
  {
    // Reference to the parent Event document
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true, // Indexed for fast event-scoped queries
    },

    // Cloudinary secure_url returned after upload
    storageUrl: {
      type: String,
      required: [true, 'storageUrl (Cloudinary CDN URL) is required'],
      trim: true,
    },

    // One entry per face detected in the photo
    faceDescriptors: {
      type: [faceDescriptorSchema],
      default: [],
    },

    // Cloudinary public_id — useful for deletion/management later
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound index: fetch all photos for an event ordered by newest ──────────
photoSchema.index({ eventId: 1, createdAt: -1 });

const Photo = mongoose.model('Photo', photoSchema);

export default Photo;
