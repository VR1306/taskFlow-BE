import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { validateUserToken } from './protectedApi.middleware.js';
import GetAllUsers from '../models/users/users.model.js';

describe('validateUserToken Middleware', () => {
  const secret = 'test-secret-key-123456789012345678901234567890';
  const sampleUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'User',
  };

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.JWT_ACCESS_SECRET = secret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateUserToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'You are not logged in. Please log in to get access.',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with TOKEN_EXPIRED code when access token is expired', async () => {
    // Generate an expired token
    const expiredToken = jwt.sign({ id: sampleUser._id }, secret, { expiresIn: '-1s' });

    const req = {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateUserToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh your token.',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with USER_NOT_FOUND when user does not exist in database', async () => {
    const validToken = jwt.sign({ id: sampleUser._id }, secret, { expiresIn: '15m' });

    jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(null);

    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateUserToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'The user belonging to this token no longer exists.',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to req and calls next when token is valid and user exists', async () => {
    const validToken = jwt.sign({ id: sampleUser._id }, secret, { expiresIn: '15m' });

    jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(sampleUser);

    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await validateUserToken(req, res, next);

    expect(req.user).toEqual(sampleUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
  it('rejects malformed credentials with the legacy JWT secret', async () => {
    const previous = process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    try {
      await validateUserToken({ headers: { authorization: 'Bearer invalid' } }, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TOKEN', message: 'Invalid token. Access denied.' })
      );
    } finally {
      process.env.JWT_ACCESS_SECRET = previous;
    }
  });
});
