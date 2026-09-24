import { jest } from '@jest/globals';
import mongoose from 'mongoose';

const cachedConnection = { connection: { name: 'cached' } };
global.mongoose = { conn: cachedConnection, promise: null };
const { default: connectDb } = await import('./database.js');

it('reuses the existing connected cache without connecting again', async () => {
  const state = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  const connect = jest.spyOn(mongoose, 'connect');
  try {
    expect(await connectDb()).toBe(cachedConnection);
    expect(connect).not.toHaveBeenCalled();
  } finally {
    mongoose.connection.readyState = state;
    jest.restoreAllMocks();
  }
});
