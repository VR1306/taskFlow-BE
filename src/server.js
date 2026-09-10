import app from './app.js';
import dotenv from 'dotenv';
import connectDb from './config/database.js';

dotenv.config();

connectDb();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
});