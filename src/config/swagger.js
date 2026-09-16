import swaggerJsDoc from 'swagger-jsdoc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow API Documentation',
      version: '1.0.0',
      description: 'Interactive OpenAPI/Swagger documentation for TaskFlow Backend REST APIs.',
      contact: {
        name: 'TaskFlow Support',
        email: 'noreplytotaskflow@gmail.com',
      },
    },
    servers: [
      {
        url: 'https://task-flow-be-eight.vercel.app',
        description: 'Production Server (Vercel)',
      },
      {
        url: 'http://localhost:5001',
        description: 'Local Development Server (Port 5001)',
      },
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server (Port 5000)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/v1/auth/signIn',
        },
      },
    },
  },
  apis: [path.join(__dirname, '../app.js'), path.join(__dirname, '../routes/**/*.js')],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export default swaggerDocs;
