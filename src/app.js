import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.routes.js';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads

// Parent Route
app.use('/api/v1', apiRoutes);

// Base Route Verification
app.get('/', (req, res) => {
  res.status(200).json({ message: "Welcome to the Base Node.js API!" });
});

export default app;