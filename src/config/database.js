import mongoose from 'mongoose';
import { seedSuperAdmin } from '../helpers/seedAdmin.js';

const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGO_DB_URL, {
            dbName: 'taskflow'
        });
        console.log(`MongoDB Connected: ${connect.connection.host} | Database: ${connect.connection.name}`);
        
        // Auto-seed SuperAdmin on startup if not already created
        await seedSuperAdmin();
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

export default connectDb;