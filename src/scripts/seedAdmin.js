import 'dotenv/config';
import mongoose from 'mongoose';
import { seedSuperAdmin } from '../helpers/seedAdmin.js';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URL, { dbName: 'taskflow' });
    await seedSuperAdmin();
    console.log('Seeding process completed.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

run();
