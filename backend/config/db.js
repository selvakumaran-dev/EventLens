import mongoose from 'mongoose';
import Admin from '../models/Admin.js';

/**
 * Seed default admin if not already present.
 */
const seedDefaultAdmin = async () => {
  try {
    const exists = await Admin.exists({ username: 'admin' });
    if (!exists) {
      const defaultSecret = process.env.ADMIN_SECRET || 'eventlens@2026';
      await Admin.create({
        username: 'admin',
        password: defaultSecret,
      });
      console.log('🤖  Default admin user auto-seeded in database.');
    }
  } catch (err) {
    console.error(`❌  Failed to seed default admin: ${err.message}`);
  }
};

/**
 * Connects to MongoDB Atlas using the MONGO_URI env variable.
 * Called once at server startup. Mongoose handles connection pooling
 * and automatic reconnection internally.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options silence deprecation warnings on Mongoose 8+
      serverSelectionTimeoutMS: 8000, // Fail fast if Atlas is unreachable
      socketTimeoutMS: 45000,
    });

    console.log(`✅  MongoDB connected → ${conn.connection.host}`);
    
    // Auto-seed default administrator credentials
    await seedDefaultAdmin();
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    process.exit(1); // Kill the process so the host (Render/Railway) restarts it
  }
};

export default connectDB;
