import { jest } from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshToken,
  generateAuthTokens,
  generateToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyToken,
  generateRandomHexToken,
  hashToken,
  extractBearerToken,
  getDatabaseStatus,
  parseAllowedOrigins,
  isOriginAllowed,
  catchAsync,
  escapeCsvValue,
  serializeCsv,
} from './helpers.js';

describe('Backend Helper Functions', () => {
  const sampleUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    role: 'Admin',
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-123456789012345678901234567890';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-12345678901234567890';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-12345678901234567890';
  });

  describe('Token Generation & Verification', () => {
    it('generates a valid access token containing user payload', () => {
      const token = generateAccessToken(sampleUser);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(sampleUser._id);
      expect(decoded.email).toBe(sampleUser.email);
      expect(decoded.role).toBe(sampleUser.role);
    });

    it('generates a valid refresh token containing user id and type refresh', () => {
      const refreshToken = generateRefreshToken(sampleUser);
      expect(typeof refreshToken).toBe('string');

      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(sampleUser._id);
      expect(decoded.type).toBe('refresh');
    });

    it('generates a valid refresh token with rememberMe flag', () => {
      const refreshToken = generateRefreshToken(sampleUser, true);
      expect(typeof refreshToken).toBe('string');

      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(sampleUser._id);
      expect(decoded.type).toBe('refresh');
      expect(decoded.rememberMe).toBe(true);
    });

    it('generateAuthTokens returns both accessToken and refreshToken with rememberMe support', () => {
      const tokens = generateAuthTokens(sampleUser, true);
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(verifyAccessToken(tokens.accessToken)).not.toBeNull();
      const decodedRefresh = verifyRefreshToken(tokens.refreshToken);
      expect(decodedRefresh).not.toBeNull();
      expect(decodedRefresh.rememberMe).toBe(true);
    });

    it('generateToken and verifyToken provide backward compatibility aliases', () => {
      const token = generateToken(sampleUser);
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(sampleUser._id);
    });

    it('returns null when verifying an invalid or malformed token', () => {
      expect(verifyAccessToken('invalid.token.here')).toBeNull();
      expect(verifyRefreshToken('invalid.token.here')).toBeNull();
      expect(verifyToken('invalid.token.here')).toBeNull();
    });
  });

  describe('Crypto & String Helpers', () => {
    it('generates random hex token of requested byte length', () => {
      const token32 = generateRandomHexToken(32);
      expect(typeof token32).toBe('string');
      expect(token32).toHaveLength(64); // 32 bytes * 2 chars/byte

      const token8 = generateRandomHexToken(8);
      expect(token8).toHaveLength(16);
    });

    it('hashes tokens deterministically with sha256', () => {
      const hash1 = hashToken('secret-token-123');
      const hash2 = hashToken('secret-token-123');
      const hashDifferent = hashToken('other-token');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashDifferent);
      expect(hash1).toHaveLength(64);
    });

    it('extracts bearer token from authorization headers correctly', () => {
      expect(extractBearerToken('Bearer token123')).toBe('token123');
      expect(extractBearerToken('Bearer "quoted-token"')).toBe('quoted-token');
      expect(extractBearerToken('rawToken')).toBe('rawToken');
      expect(extractBearerToken('')).toBeNull();
      expect(extractBearerToken(null)).toBeNull();
    });

    it('escapes special regex characters correctly using String.raw', () => {
      const { escapeRegex } = jest.requireActual('./helpers.js');
      expect(escapeRegex('test (user)+[1]?')).toBe(String.raw`test \(user\)\+\[1\]\?`);
      expect(escapeRegex('user@domain.com')).toBe(String.raw`user@domain\.com`);
      expect(escapeRegex('normalText')).toBe('normalText');
    });
  });

  describe('Database & Environment Helpers', () => {
    it('maps mongoose readyState to readable status string', () => {
      expect(getDatabaseStatus(0)).toBe('disconnected');
      expect(getDatabaseStatus(1)).toBe('connected');
      expect(getDatabaseStatus(2)).toBe('connecting');
      expect(getDatabaseStatus(3)).toBe('disconnecting');
      expect(getDatabaseStatus(99)).toBe('unknown');
    });

    it('determines if origin is allowed based on CORS config', () => {
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(isOriginAllowed('https://taskflow-app.vercel.app')).toBe(true);
      expect(isOriginAllowed('')).toBe(true); // Non-browser / same-origin requests
      expect(parseAllowedOrigins()).toContain('http://localhost:3000');
    });
  });

  describe('catchAsync Error Handling Middleware Wrapper', () => {
    it('executes async function successfully when no error is thrown', async () => {
      const mockReq = {};
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const mockNext = jest.fn();

      const asyncFn = async (_req, res) => {
        return res.status(200).json({ success: true });
      };

      const wrappedFn = catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('catches thrown error and responds with status 500', async () => {
      const mockReq = {};
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const mockNext = jest.fn();

      const asyncFn = async () => {
        throw new Error('Database connection failed');
      };

      const wrappedFn = catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal Database Server Error',
        error: 'Database connection failed',
      });
    });
  });

  describe('CSV Export Serialization Helpers', () => {
    it('escapes CSV values with commas, quotes, and newlines', () => {
      expect(escapeCsvValue('Simple')).toBe('Simple');
      expect(escapeCsvValue('Hello, World')).toBe('"Hello, World"');
      expect(escapeCsvValue('Quote "test"')).toBe('"Quote ""test"""');
      expect(escapeCsvValue('Multi\nLine')).toBe('"Multi\nLine"');
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
      expect(escapeCsvValue(123)).toBe('123');
    });

    it('serializes header and data rows into valid CSV output', () => {
      const headers = ['ID', 'Name', 'Role'];
      const rows = [
        ['TF0001', 'John Doe', 'Admin'],
        ['TF0002', 'Jane, "Smith"', 'User'],
      ];
      const result = serializeCsv(headers, rows);
      expect(result).toBe('ID,Name,Role\nTF0001,John Doe,Admin\nTF0002,"Jane, ""Smith""",User');
    });
  });
  it('supports legacy secret configuration and scalar user IDs', () => {
    const previous = { ...process.env };
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.JWT_EXPIRES_IN = '5m';
    process.env.JWT_REFRESH_EXPIRES_IN = '1d';
    process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN = '2d';
    try {
      expect(verifyAccessToken(generateAccessToken({ id: 'u1' })).id).toBe('u1');
      expect(verifyAccessToken(generateAccessToken('u2')).id).toBe('u2');
      expect(verifyRefreshToken(generateRefreshToken({ id: 'u1' })).id).toBe('u1');
      expect(verifyRefreshToken(generateRefreshToken('u2', true)).id).toBe('u2');
      expect(generateAuthTokens('u3').accessToken).toEqual(expect.any(String));
      expect(generateRandomHexToken()).toHaveLength(64);
      expect(isOriginAllowed('http://127.0.0.1:9999')).toBe(true);
      expect(isOriginAllowed('https://untrusted.example')).toBe(false);
    } finally {
      process.env = previous;
    }
  });
});
