import { jest } from '@jest/globals';
import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';

describe('Express App Route & Middleware Tests', () => {
  let server;
  let baseUrl;
  const originalReadyState = mongoose.connection.readyState;

  beforeAll((done) => {
    mongoose.connection.readyState = 1;
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll(async () => {
    mongoose.connection.readyState = originalReadyState;
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET / returns 200 welcome message', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Welcome to the Base Node.js API!');
    expect(data.healthCheck).toBe('/health');
    expect(data.apiDocumentation).toBe('/api-docs');
  });

  it('GET /health returns health and database diagnostic status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data.status).toBeDefined();
    expect(data.database).toBeDefined();
    expect(data.environment).toBeDefined();
  });

  it('GET /logo.svg returns SVG content type and vector markup', async () => {
    const res = await fetch(`${baseUrl}/logo.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    const text = await res.text();
    expect(text).toContain('<svg');
  });

  it('GET /favicon.ico and /favicon.svg returns SVG content', async () => {
    const resIco = await fetch(`${baseUrl}/favicon.ico`);
    expect(resIco.status).toBe(200);
    expect(resIco.headers.get('content-type')).toContain('image/svg+xml');

    const resSvg = await fetch(`${baseUrl}/favicon.svg`);
    expect(resSvg.status).toBe(200);
    expect(resSvg.headers.get('content-type')).toContain('image/svg+xml');
  });

  it('GET /api-docs.json returns OpenAPI JSON specification', async () => {
    const res = await fetch(`${baseUrl}/api-docs.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data.openapi || data.swagger || data.info).toBeDefined();
  });

  it('GET /api-docs and /docs returns Swagger UI HTML documentation page', async () => {
    const res = await fetch(`${baseUrl}/api-docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('TaskFlow API Documentation');

    const resDocs = await fetch(`${baseUrl}/docs`);
    expect(resDocs.status).toBe(200);
  });

  it('GET /api/v1/users/getAllUsers returns 401 when token is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/getAllUsers`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('handles CORS options request with allowed headers and methods', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/getAllUsers`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status).toBe(204);
  });
  it('reports a failed health check when the database cannot reconnect', async () => {
    const mongoUri = process.env.MONGO_DB_URL;
    delete process.env.MONGO_DB_URL;
    mongoose.connection.readyState = 0;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        status: 'unhealthy',
        database: { status: 'disconnected' },
      });
    } finally {
      mongoose.connection.readyState = 1;
      if (mongoUri === undefined) delete process.env.MONGO_DB_URL;
      else process.env.MONGO_DB_URL = mongoUri;
    }
  });

  it('returns a database error before serving API requests when connection fails', async () => {
    const mongoUri = process.env.MONGO_DB_URL;
    delete process.env.MONGO_DB_URL;
    mongoose.connection.readyState = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await fetch(`${baseUrl}/api/v1/users/getAllUsers`);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        success: false,
        message: 'Internal Database Server Error',
      });
    } finally {
      mongoose.connection.readyState = 1;
      if (mongoUri === undefined) delete process.env.MONGO_DB_URL;
      else process.env.MONGO_DB_URL = mongoUri;
    }
  });
  it('does not grant cross-origin access to an untrusted origin', async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
