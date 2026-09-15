import 'dotenv/config';
import connectDb from './config/database.js';
import app from './app.js';

connectDb();

const PORT = process.env.PORT || 5000;

 app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`);
});