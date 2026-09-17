import swaggerDocs from './swagger.js';

describe('Swagger Configuration Tests', () => {
  it('should generate a valid OpenAPI 3.0 specification object', () => {
    expect(swaggerDocs).toBeDefined();
    expect(swaggerDocs.openapi).toBe('3.0.0');
    expect(swaggerDocs.info).toBeDefined();
    expect(swaggerDocs.info.title).toBe('TaskFlow API Documentation');
    expect(swaggerDocs.info.version).toBe('1.0.0');
    expect(swaggerDocs.servers).toHaveLength(3);
    expect(swaggerDocs.components?.securitySchemes?.BearerAuth).toBeDefined();
  });
});
