import { jest } from '@jest/globals';
import Joi from 'joi';
import { validateRequest } from './validateSchema.js';

describe('Validate Schema Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('calls next when schema is not provided', () => {
    const middleware = validateRequest(null);
    middleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('validates and strips unknown fields for valid Joi schema', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      role: Joi.string().valid('Admin', 'User').default('User'),
    });

    mockReq.body = {
      email: 'valid@example.com',
      role: 'Admin',
      unknownField: 'should be stripped',
    };

    const middleware = validateRequest(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.body).toEqual({
      email: 'valid@example.com',
      role: 'Admin',
    });
  });

  it('returns 400 with errors array for invalid Joi schema', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
    });

    mockReq.body = {
      email: 'invalid-email',
      password: 'short',
    };

    const middleware = validateRequest(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errors: expect.any(Array),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('handles fallback validation when schema is a constructor/function', () => {
    class MockModel {
      constructor(data) {
        this.data = data;
      }
      validateSync() {
        if (!this.data.name) {
          return { errors: { name: { message: 'Name is required' } } };
        }
        return null;
      }
    }
    MockModel.schema = {};

    mockReq.body = {};
    const middleware = validateRequest(MockModel);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      errors: ['Name is required'],
    });

    mockReq.body = { name: 'Valid' };
    mockNext.mockClear();
    middleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
  it('reports model construction errors without calling next', () => {
    const schema = jest.fn(function () {
      throw new Error('Invalid model input');
    });
    validateRequest(schema)(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ success: false, errors: ['Invalid model input'] });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('continues when passed a schema with no validator', () => {
    validateRequest({})(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
