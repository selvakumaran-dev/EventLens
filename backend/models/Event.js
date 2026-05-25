import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const eventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [120, 'Event name cannot exceed 120 characters'],
    },

    // Stored as a bcrypt hash; never persisted as plain text
    eventPassword: {
      type: String,
      required: [true, 'Event password is required'],
      minlength: [4, 'Password must be at least 4 characters'],
    },

    // Human-readable slug for QR code URLs (auto-generated if omitted)
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    // Optional: photographer display name shown on guest UI
    photographerName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Pre-save hook: hash the password before persisting ──────────────────────
eventSchema.pre('save', async function (next) {
  // Only hash when the password field has been modified (includes creation)
  if (!this.isModified('eventPassword')) return next();

  const SALT_ROUNDS = 12;
  this.eventPassword = await bcrypt.hash(this.eventPassword, SALT_ROUNDS);
  next();
});

// ── Instance method: validate a plain-text candidate against the hash ────────
eventSchema.methods.verifyPassword = async function (candidatePlainText) {
  return bcrypt.compare(candidatePlainText, this.eventPassword);
};

// ── Auto-generate a URL-safe slug from the event name if not provided ────────
eventSchema.pre('validate', function (next) {
  if (!this.slug && this.eventName) {
    this.slug = this.eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
