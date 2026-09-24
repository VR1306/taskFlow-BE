import { jest } from '@jest/globals';

const middleware = jest.fn();
class UploadError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const multer = Object.assign(
  jest.fn(() => ({ single: () => middleware })),
  {
    memoryStorage: jest.fn(),
    MulterError: UploadError,
  }
);
jest.unstable_mockModule('multer', () => ({ default: multer }));
const { uploadMiddleware } = await import('./attachments.controller.js');

it.each([
  [new UploadError('LIMIT_FILE_SIZE'), /maximum allowed size/],
  [new UploadError('LIMIT_UNEXPECTED_FILE'), /LIMIT_UNEXPECTED_FILE/],
  [new Error('Malformed multipart body'), /Malformed multipart body/],
])('rejects failed uploads: %s', (error, message) => {
  middleware.mockImplementation((_req, _res, callback) => callback(error));
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  uploadMiddleware({}, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    message: expect.stringMatching(message),
  });
  expect(next).not.toHaveBeenCalled();
});

it('continues successful uploads', () => {
  middleware.mockImplementation((_req, _res, callback) => callback());
  const next = jest.fn();
  uploadMiddleware({}, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
});
