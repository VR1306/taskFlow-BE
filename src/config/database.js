import mongoose from 'mongoose';
import { seedSuperAdmin } from '../helpers/seedAdmin.js';
import { seedDefaultRoles } from '../helpers/seedRoles.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDb = async () => {
  if (mongoose.connection.readyState === 1) {
    if (!cached.conn) {
      cached.conn = mongoose;
    }
    return cached.conn;
  }

  const mongoUri = process.env.MONGO_DB_URL;
  if (!mongoUri) {
    throw new Error('MONGO_DB_URL environment variable is missing.');
  }

  if (!cached.promise) {
    const opts = {
      dbName: 'taskflow',
      serverSelectionTimeoutMS: 8000,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then(async (mongooseInstance) => {
      console.log(
        `MongoDB Connected: ${mongooseInstance.connection.host} | Database: ${mongooseInstance.connection.name}`
      );

      // Auto-seed SuperAdmin & Default Roles on startup if not already created
      try {
        await seedSuperAdmin();
        await seedDefaultRoles();
      } catch (seedErr) {
        console.error('Database seeding warning:', seedErr.message);
      }
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }

  return cached.conn;
};

export default connectDb;
