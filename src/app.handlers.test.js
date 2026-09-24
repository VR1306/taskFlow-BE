import { jest } from '@jest/globals';
import mongoose from 'mongoose';
const connect = jest.fn();
jest.unstable_mockModule('./config/database.js', () => ({ default: connect }));
const { default: app } = await import('./app.js');
const health = app.router.stack.find((layer) => layer.route?.path === '/health').route.stack[0]
  .handle;
const originalState = mongoose.connection.readyState;
const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  jest.restoreAllMocks();
  mongoose.connection.readyState = originalState;
  process.env.NODE_ENV = originalEnv;
});

it('reconnects during a health check and supplies the default environment', async () => {
  mongoose.connection.readyState = 0;
  delete process.env.NODE_ENV;
  connect.mockImplementation(async () => {
    mongoose.connection.readyState = 1;
  });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await health({}, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'healthy', environment: 'development' })
  );
});

it('handles rejection values without an error message', async () => {
  mongoose.connection.readyState = 0;
  connect.mockRejectedValue(null);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await health({}, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(warn).toHaveBeenCalledWith('Health check database reconnection failed: unknown error');
});
