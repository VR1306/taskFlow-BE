import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import connectDb from './database.js';
import GetAllUsers from '../models/users/users.model.js';
import Role from '../models/roles/roles.model.js';

describe('Database Connection Module Tests', () => {
  const originalEnv = process.env.MONGO_DB_URL;

  beforeEach(() => {
    if (global.mongoose) {
      global.mongoose.conn = null;
      global.mongoose.promise = null;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.MONGO_DB_URL = originalEnv;
    if (global.mongoose) {
      global.mongoose.conn = null;
      global.mongoose.promise = null;
    }
  });

  it('should throw an error if MONGO_DB_URL is missing', async () => {
    delete process.env.MONGO_DB_URL;

    await expect(connectDb()).rejects.toThrow('MONGO_DB_URL environment variable is missing.');
  });

  it('should connect to mongoose successfully and run seedSuperAdmin', async () => {
    process.env.MONGO_DB_URL = 'mongodb://localhost:27017/test';

    const mockMongooseInstance = {
      connection: {
        host: 'localhost',
        name: 'taskflow',
      },
    };

    jest.spyOn(mongoose, 'connect').mockResolvedValue(mockMongooseInstance);
    jest
      .spyOn(GetAllUsers, 'findOne')
      .mockResolvedValue({ email: 'admin@taskflow.com', userId: 'TF0001' });
    jest.spyOn(Role, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Super Admin' }),
    });

    const conn = await connectDb();

    expect(conn).toStrictEqual(mockMongooseInstance);
    expect(GetAllUsers.findOne).toHaveBeenCalled();
  });

  it('should return existing connection if cached and readyState is 1', async () => {
    process.env.MONGO_DB_URL = 'mongodb://localhost:27017/test';
    const mockMongooseInstance = {
      connection: {
        host: 'localhost',
        name: 'taskflow',
      },
    };

    jest.spyOn(mongoose, 'connect').mockResolvedValue(mockMongooseInstance);
    jest
      .spyOn(GetAllUsers, 'findOne')
      .mockResolvedValue({ email: 'admin@taskflow.com', userId: 'TF0001' });
    jest.spyOn(Role, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Super Admin' }),
    });

    const conn1 = await connectDb();
    expect(conn1).toStrictEqual(mockMongooseInstance);

    const conn2 = await connectDb();
    expect(conn2).toBeDefined();
  });

  it('should handle seedSuperAdmin error gracefully during connection', async () => {
    process.env.MONGO_DB_URL = 'mongodb://localhost:27017/test';

    const mockMongooseInstance = {
      connection: {
        host: 'localhost',
        name: 'taskflow',
      },
    };

    jest.spyOn(mongoose, 'connect').mockResolvedValue(mockMongooseInstance);
    jest.spyOn(GetAllUsers, 'findOne').mockRejectedValue(new Error('Seed query failed'));
    jest.spyOn(Role, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: 'Super Admin' }),
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const conn = await connectDb();
    expect(conn).toStrictEqual(mockMongooseInstance);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error seeding default accounts:',
      'Seed query failed'
    );
  });

  it('should reset cached promise and rethrow when connection fails', async () => {
    process.env.MONGO_DB_URL = 'mongodb://localhost:27017/test';

    jest.spyOn(mongoose, 'connect').mockRejectedValue(new Error('Connection Timeout'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(connectDb()).rejects.toThrow('Connection Timeout');
    expect(global.mongoose.promise).toBeNull();
  });
});
