import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import 'dotenv/config';
import connectDb from './config/database.js';
import swaggerDocs from './config/swagger.js';
import apiRoutes from './routes/api.routes.js';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads

// Swagger UI Options with CDN assets for flawless local & Vercel serverless rendering
const swaggerUiOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
  ],
  customSiteTitle: 'TaskFlow API Documentation',
};

// Swagger Raw JSON Route (useful for Postman imports)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// Swagger UI Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, swaggerUiOptions));

// Helper to get readable DB status
const getDatabaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * @swagger
 * tags:
 *   name: Diagnostics
 *   description: System Health & Diagnostics
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System & Database Health Check
 *     description: Returns real-time health, server uptime, environment, and MongoDB connection status.
 *     tags: [Diagnostics]
 *     security: []
 *     responses:
 *       200:
 *         description: System and database are healthy
 *       503:
 *         description: Database is disconnected or experiencing errors
 */
app.get('/health', async (req, res) => {
  let dbStatus = getDatabaseStatus();

  if (dbStatus !== 'connected') {
    try {
      await connectDb();
      dbStatus = getDatabaseStatus();
    } catch (err) {
      dbStatus = 'disconnected';
    }
  }

  const isHealthy = dbStatus === 'connected';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(2)}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'none',
      host: mongoose.connection.host || 'none',
    },
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Welcome & Status
 *     description: Base endpoint confirming API deployment status.
 *     tags: [Diagnostics]
 *     security: []
 *     responses:
 *       200:
 *         description: API is online
 */
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Welcome to the Base Node.js API!",
    healthCheck: "/health",
    apiDocumentation: "/api-docs"
  });
});

// Ensure MongoDB is connected before handling any /api routes (crucial for Serverless / Vercel)
app.use('/api', async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    console.error('Database connection error in middleware:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal Database Server Error',
      error: error.message
    });
  }
});

// Parent Route
app.use('/api', apiRoutes);

export default app;