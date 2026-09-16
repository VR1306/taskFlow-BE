import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import connectDb from './config/database.js';
import swaggerDocs from './config/swagger.js';
import apiRoutes from './routes/api.routes.js';

const app = express();
app.disable('x-powered-by');

// CORS configuration
const parseAllowedOrigins = () => {
  const envOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
    : [];
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    ...envOrigins,
  ].filter(Boolean);
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = parseAllowedOrigins();
  if (allowed.includes(origin) || allowed.includes('*')) {
    return true;
  }
  return (
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  optionsSuccessStatus: 204,
};

// Global Middlewares
app.use(cors(corsOptions));
app.use(express.json()); // Parses incoming JSON payloads

// Swagger Raw JSON Route (useful for Postman imports)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocs);
});

// Standalone Swagger UI HTML (Bulletproof for local dev & Vercel serverless functions)
const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/favicon-32x32.png" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;

app.get(['/api-docs', '/docs'], (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(swaggerHtml);
});

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
      console.warn(`Health check database reconnection failed: ${err?.message || 'unknown error'}`);
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
    message: 'Welcome to the Base Node.js API!',
    healthCheck: '/health',
    apiDocumentation: '/api-docs',
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
      error: error.message,
    });
  }
});

// Parent Route
app.use('/api', apiRoutes);

export default app;
