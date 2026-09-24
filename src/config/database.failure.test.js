import { jest } from '@jest/globals';
import mongoose from 'mongoose';

const seed = jest.fn();
jest.unstable_mockModule('../helpers/seedAdmin.js', () => ({ seedSuperAdmin: seed }));
jest.unstable_mockModule('../helpers/seedRoles.js', () => ({ seedDefaultRoles: jest.fn() }));
const { default: connectDb } = await import('./database.js');

afterEach(() => jest.restoreAllMocks());

it('keeps a successful connection when startup seeding fails', async () => {
  const previousUri = process.env.MONGO_DB_URL;
  process.env.MONGO_DB_URL = 'mongodb://localhost/test';
  global.mongoose.conn = null;
  global.mongoose.promise = null;
  const connection = { connection: { host: 'localhost', name: 'test' } };
  jest.spyOn(mongoose, 'connect').mockResolvedValue(connection);
  seed.mockRejectedValue(new Error('Seed unavailable'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    expect(await connectDb()).toBe(connection);
    expect(log).toHaveBeenCalledWith('Database seeding warning:', 'Seed unavailable');
  } finally {
    if (previousUri === undefined) delete process.env.MONGO_DB_URL;
    else process.env.MONGO_DB_URL = previousUri;
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }
});
