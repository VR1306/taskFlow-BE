import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import {
  signInUserApiCall,
  refreshTokenApiCall,
  logoutUserApiCall,
  forgotPasswordEmailVerification,
  resetPasswordFunction,
  changePasswordFunction,
} from './auth.controller.js';
import GetAllUsers from '../../models/users/users.model.js';
import Role from '../../models/roles/roles.model.js';
import { generateRefreshToken, hashToken } from '../../helpers/helpers.js';

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

    it('returns 200 with tokens and user data on valid login', async () => {
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
          rememberMe: false,
          token: expect.any(String),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            id: '507f1f77bcf86cd799439011',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            role: 'Admin',
          }),
        })
      );
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('returns 200 and rememberMe: true when rememberMe flag is provided', async () => {
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

      const req = {
        body: {
          email: 'jane@example.com',
          password: 'CorrectPassword@123',
          rememberMe: true,
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          rememberMe: true,
        })
      );
    });

    it("includes the role's resolved permissions on the user object, so the frontend sidebar/route guards can gate modules without a separate lookup", async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Rithika',
        lastName: 'Suresh',
        email: 'rithika@example.com',
        role: 'QA',
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          name: 'QA',
          permissions: ['projects.view', 'tasks.view', 'tasks.create', 'tasks.edit'],
        }),
      });

      const req = { body: { email: 'rithika@example.com', password: 'CorrectPassword@123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await signInUserApiCall(req, res, next);

      expect(Role.findOne).toHaveBeenCalledWith({ name: 'QA', isDeleted: { $ne: true } });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            role: 'QA',
            permissions: ['projects.view', 'tasks.view', 'tasks.create', 'tasks.edit'],
          }),
        })
      );
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

    it('returns 401 if user belonging to token is not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const validRefreshToken = generateRefreshToken({ _id: userId });

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(null);

      const req = { body: { refreshToken: validRefreshToken } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await refreshTokenApiCall(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
        })
      );
    });

    it('returns 401 and invalidates sessions if token is not found in user record (reuse detection)', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const validRefreshToken = generateRefreshToken({ _id: userId });

      const mockUser = {
        _id: userId,
        refreshTokens: [{ token: 'different-token' }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = { body: { refreshToken: validRefreshToken } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await refreshTokenApiCall(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_REVOKED',
        })
      );
      expect(mockUser.refreshTokens).toEqual([]);
      expect(mockUser.save).toHaveBeenCalled();
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

    it('clears all sessions when logged out with user id and no specific refresh token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        refreshTokens: [{ token: 'token-1' }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = { user: { _id: userId } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await logoutUserApiCall(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockUser.refreshTokens).toEqual([]);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('forgotPasswordEmailVerification', () => {
    it('returns 400 if email is missing', async () => {
      const req = { body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await forgotPasswordEmailVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required',
      });
    });

    it('returns 404 if user is not found', async () => {
      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);

      const req = { body: { email: 'unknown@example.com' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await forgotPasswordEmailVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('saves reset token and sends email successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Alex',
        lastName: 'Ray',
        email: 'alex@example.com',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      });

      const req = { body: { email: 'alex@example.com' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await forgotPasswordEmailVerification(req, res);

      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('successfully dispatched'),
        })
      );
    });

    it('rolls back token and returns 500 when email delivery fails', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Alex',
        email: 'alex@example.com',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);
      const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP Connection Refused'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        sendMail: mockSendMail,
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const req = { body: { email: 'alex@example.com' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await forgotPasswordEmailVerification(req, res);

      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Error sending the email. Try again later.',
        })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('resetPasswordFunction', () => {
    it('returns 400 if token is missing', async () => {
      const req = { query: {}, params: {}, body: { password: 'Pass', confirmPassword: 'Pass' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await resetPasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Reset token is required',
      });
    });

    it('returns 400 if password is missing', async () => {
      const req = { query: { token: 'sample-token' }, params: {}, body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await resetPasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password is required',
      });
    });

    it('returns 400 if passwords do not match', async () => {
      const req = {
        query: { token: 'sample-token' },
        params: {},
        body: { password: 'NewPassword123!', confirmPassword: 'DifferentPassword123!' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await resetPasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Passwords do not match',
      });
    });

    it('returns 401 if token is invalid or expired', async () => {
      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);

      const req = {
        query: { token: 'invalid-or-expired-token' },
        params: {},
        body: { password: 'NewPassword123!', confirmPassword: 'NewPassword123!' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await resetPasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token is invalid or has expired',
      });
    });

    it('resets password and clears reset token on valid request', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        passwordResetToken: hashToken('valid-token'),
        password: 'OldPassword',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUser);

      const req = {
        query: { token: 'valid-token' },
        params: {},
        body: { password: 'BrandNewPassword123!', confirmPassword: 'BrandNewPassword123!' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await resetPasswordFunction(req, res);

      expect(mockUser.password).toBe('BrandNewPassword123!');
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Password reset successful'),
        })
      );
    });
  });

  describe('changePasswordFunction', () => {
    it('returns 400 if required fields are missing', async () => {
      const req = { user: { _id: 'user-1' }, body: { currentPassword: '123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await changePasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'All fields are required',
      });
    });

    it('returns 400 if new password and confirmPassword do not match', async () => {
      const req = {
        user: { _id: 'user-1' },
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'MismatchPassword123!',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await changePasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'New passwords do not match',
      });
    });

    it('returns 404 if user is not found', async () => {
      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(null);

      const req = {
        user: { _id: 'nonexistent-user' },
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await changePasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('returns 401 if current password is incorrect', async () => {
      const mockUser = {
        _id: 'user-1',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = {
        user: { _id: 'user-1' },
        body: {
          currentPassword: 'WrongCurrentPassword',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await changePasswordFunction(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect',
      });
    });

    it('changes password successfully on valid input', async () => {
      const mockUser = {
        _id: 'user-1',
        password: 'OldPassword',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(mockUser);

      const req = {
        user: { _id: 'user-1' },
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await changePasswordFunction(req, res);

      expect(mockUser.password).toBe('NewPassword123!');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully!',
      });
    });
  });
  it.each([undefined, Array.from({ length: 10 }, (_, index) => ({ token: `old-${index}` }))])(
    'normalizes and bounds refresh sessions: %j',
    async (refreshTokens) => {
      const user = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn(),
        refreshTokens,
      };
      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(user);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await signInUserApiCall({ body: { email: user.email, password: 'Password@123' } }, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(user.refreshTokens).toHaveLength(refreshTokens ? 10 : 1);
      expect(user.refreshTokens.at(-1).token).toEqual(expect.any(String));
      if (refreshTokens) expect(user.refreshTokens[0].token).toBe('old-1');
    }
  );
  it('rejects a refresh token when the account has no stored sessions', async () => {
    const user = { _id: 'user-1', save: jest.fn() };
    jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(user);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await refreshTokenApiCall({ body: { refreshToken: generateRefreshToken('user-1') } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }));
  });

  it.each([
    [{ body: { refreshToken: 'invalid' } }, null],
    [{ body: {} }, null],
    [{ user: { id: 'user-1' } }, null],
    [{ user: { id: 'user-1' }, body: { refreshToken: 'invalid' } }, {}],
  ])(
    'makes logout idempotent when credentials or stored sessions are missing: %j',
    async (req, user) => {
      jest.spyOn(GetAllUsers, 'findById').mockResolvedValue(user);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await logoutUserApiCall(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    }
  );

  it.each(['https://example.com/', ' ,https://example.com'])(
    'normalizes reset URLs and unnamed accounts: %s',
    async (url) => {
      const previous = process.env.RESET_PASSWORD_CLIENT_URL;
      process.env.RESET_PASSWORD_CLIENT_URL = url;
      jest
        .spyOn(GetAllUsers, 'findOne')
        .mockResolvedValue({ email: 'user@example.com', save: jest.fn() });
      const sendMail = jest.fn().mockResolvedValue({});
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      try {
        await forgotPasswordEmailVerification({ body: { email: 'user@example.com' } }, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
      } finally {
        if (previous === undefined) delete process.env.RESET_PASSWORD_CLIENT_URL;
        else process.env.RESET_PASSWORD_CLIENT_URL = previous;
      }
    }
  );

  it('accepts the request user id alias when validating password changes', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await changePasswordFunction({ user: { id: 'user-1' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
