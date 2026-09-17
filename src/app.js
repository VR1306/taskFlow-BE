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

// Serve logo SVG
app.get(['/logo.svg', '/favicon.ico', '/favicon.svg'], (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <defs>
    <linearGradient id="taskflowLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
  </defs>
  <rect x="4.5" y="4.5" width="9.5" height="9.5" rx="2.8" stroke="url(#taskflowLogoGrad)" stroke-width="2.8" />
  <rect x="18" y="4.5" width="9.5" height="9.5" rx="2.8" stroke="url(#taskflowLogoGrad)" stroke-width="2.8" />
  <rect x="18" y="18" width="9.5" height="9.5" rx="2.8" stroke="url(#taskflowLogoGrad)" stroke-width="2.8" />
  <rect x="4.5" y="18" width="9.5" height="9.5" rx="2.8" stroke="url(#taskflowLogoGrad)" stroke-width="2.8" />
</svg>`);
});

// Swagger Raw JSON Route (useful for Postman imports)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocs);
});

// Standalone Swagger UI HTML with TaskFlow branding and logo
const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .swagger-ui .topbar { display: none; }
    
    /* Branded TaskFlow Header */
    .taskflow-header {
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 0.875rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .taskflow-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
    }
    .taskflow-logo-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background: #ffffff;
      border-radius: 10px;
      padding: 5px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .taskflow-brand-info {
      display: flex;
      flex-direction: column;
    }
    .taskflow-brand-name {
      color: #ffffff;
      font-size: 1.125rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .taskflow-brand-tag {
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .taskflow-header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .taskflow-app-link {
      background: #2563eb;
      color: #ffffff;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.45rem 0.875rem;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .taskflow-app-link:hover {
      background: #1d4ed8;
    }
    .swagger-ui .info {
      margin: 25px 0 20px 0;
    }
  </style>
</head>
<body>
  <header class="taskflow-header">
    <a href="/api-docs" class="taskflow-brand">
      <div class="taskflow-logo-badge">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" fill="none">
          <defs>
            <linearGradient id="tfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="50%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#4f46e5" />
            </linearGradient>
          </defs>
          <rect x="4.5" y="4.5" width="9.5" height="9.5" rx="2.8" stroke="url(#tfGrad)" stroke-width="2.8" />
          <rect x="18" y="4.5" width="9.5" height="9.5" rx="2.8" stroke="url(#tfGrad)" stroke-width="2.8" />
          <rect x="18" y="18" width="9.5" height="9.5" rx="2.8" stroke="url(#tfGrad)" stroke-width="2.8" />
          <rect x="4.5" y="18" width="9.5" height="9.5" rx="2.8" stroke="url(#tfGrad)" stroke-width="2.8" />
        </svg>
      </div>
      <div class="taskflow-brand-info">
        <span class="taskflow-brand-name">TaskFlow</span>
        <span class="taskflow-brand-tag">REST API Documentation</span>
      </div>
    </a>
    <div class="taskflow-header-actions">
      <a href="https://taskflow-fe-beryl.vercel.app" target="_blank" rel="noopener noreferrer" class="taskflow-app-link">Launch Web App &rarr;</a>
    </div>
  </header>

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
