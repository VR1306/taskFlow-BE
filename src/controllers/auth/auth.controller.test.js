import { jest } from '@jest/globals';
import { signInUserApiCall, refreshTokenApiCall, logoutUserApiCall } from './auth.controller.js';
import GetAllUsers from '../../models/users/users.model.js';
import { generateRefreshToken } from '../../helpers/helpers.js';

describe('Auth Controller Tests', () => {
  const secret = 'test-secret-key-123456789012345678901234567890';

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.JWT_ACCESS_SECRET = secret;
    process.env.JWT_REFRESH_SECRET = secret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('signInUserApiCall', () => {
    it('returns 400 if email or password are missing', async () => {
      const req = { body: { email: 'test@example.com' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email and password are required',
      });
    });

    it('returns 404 if user is not found', async () => {
      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);

      const req = { body: { email: 'unknown@example.com', password: 'Password@123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('returns 401 if password is invalid', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);

      const req = { body: { email: 'user@example.com', password: 'WrongPassword' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid password',
      });
    });

    it('returns 200 with tokens, defaultModule: users, and user data on valid login', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        role: 'Admin',
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);

      const req = { body: { email: 'jane@example.com', password: 'CorrectPassword@123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Sign-in successful!',
          defaultModule: 'users',
          redirectUrl: '/users',
          token: expect.any(String),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: {
            id: '507f1f77bcf86cd799439011',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: 'Admin',
          },
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('refreshTokenApiCall', () => {
    it('returns 400 if refreshToken is missing', async () => {
      const req = { body: {}, headers: {}, cookies: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await refreshTokenApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refresh token is required',
      });
    });

    it('returns 401 if refresh token is cryptographically invalid or expired', async () => {
      const req = { body: { refreshToken: 'invalid.token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await refreshTokenApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_REFRESH_TOKEN',
        })
      );
    });

    it('rotates refresh token and returns new tokens on valid refresh token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const validRefreshToken = generateRefreshToken({ _id: userId });

      const mockUser = {
        _id: userId,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        role: 'Admin',
        refreshTokens: [{ token: validRefreshToken, createdAt: new Date() }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = { body: { refreshToken: validRefreshToken } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await refreshTokenApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Token refreshed successfully!',
          token: expect.any(String),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('logoutUserApiCall', () => {
    it('revokes refresh token from user record and returns 200', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const tokenToRevoke = generateRefreshToken({ _id: userId });

      const mockUser = {
        _id: userId,
        refreshTokens: [{ token: tokenToRevoke }, { token: 'other-token' }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = { body: { refreshToken: tokenToRevoke } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await logoutUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
      expect(mockUser.refreshTokens).toEqual([{ token: 'other-token' }]);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
