import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      default: 'admin',
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save hook: hash password before saving ──────────────────────────────
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const SALT_ROUNDS = 12;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// ── Instance method: verify candidate password ──────────────────────────────
adminSchema.methods.verifyPassword = async function (candidatePlainText) {
  return bcrypt.compare(candidatePlainText, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
