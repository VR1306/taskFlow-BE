import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import GetAllUsers, { getNextUserId } from './users.model.js';

describe('Users Model Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('instantiates user model with schema fields and defaults', () => {
    const user = new GetAllUsers({
      firstName: 'Alice',
      lastName: 'Wonder',
      email: 'alice@wonderland.com',
      password: 'PlainPassword123!',
    });

    expect(user.firstName).toBe('Alice');
    expect(user.lastName).toBe('Wonder');
    expect(user.email).toBe('alice@wonderland.com');
    expect(user.role).toBe('User');
    expect(user.isDeleted).toBe(false);
    expect(user.refreshTokens).toEqual([]);
  });

  it('getNextUserId computes sequential TF0001 when no prior users exist', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextUserId(mockModel);
    expect(nextId).toBe('TF0001');
  });

  it('getNextUserId increments highest existing TF ID correctly', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ userId: 'TF0009' }),
          }),
        }),
      }),
    };

    const nextId = await getNextUserId(mockModel);
    expect(nextId).toBe('TF0010');
  });

  it('hashes password on pre-save hook when password is modified', async () => {
    const user = new GetAllUsers({
      userId: 'TF0001',
      firstName: 'Bob',
      lastName: 'Marley',
      email: 'bob@reggae.com',
      password: 'MyRawPassword123!',
    });

    user.isModified = jest.fn((field) => field === 'password');
    jest.spyOn(bcrypt, 'genSalt').mockResolvedValue('mocked-salt');
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password-12345');

    const pres = GetAllUsers.schema.s.hooks._pres.get('save') || [];
    for (const hook of pres) {
      if (typeof hook.fn === 'function') {
        await hook.fn.call(user);
      }
    }

    expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
    expect(bcrypt.hash).toHaveBeenCalledWith('MyRawPassword123!', 'mocked-salt');
    expect(user.password).toBe('hashed-password-12345');
  });

  it('skips password hashing on pre-save hook when password is not modified', async () => {
    const user = new GetAllUsers({
      userId: 'TF0002',
      firstName: 'Charlie',
      lastName: 'Chaplin',
      email: 'charlie@cinema.com',
      password: 'ExistingHashedPassword',
    });

    user.isModified = jest.fn(() => false);
    const hashSpy = jest.spyOn(bcrypt, 'hash');

    const pres = GetAllUsers.schema.s.hooks._pres.get('save') || [];
    for (const hook of pres) {
      if (typeof hook.fn === 'function') {
        await hook.fn.call(user);
      }
    }

    expect(hashSpy).not.toHaveBeenCalled();
  });

  it('compares entered password with hashed password using bcrypt.compare', async () => {
    const user = new GetAllUsers({
      firstName: 'Dave',
      lastName: 'Grohl',
      email: 'dave@rock.com',
      password: 'hashed-password-xyz',
    });

    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const isValid = await user.comparePassword('MyPassword123!');

    expect(compareSpy).toHaveBeenCalledWith('MyPassword123!', 'hashed-password-xyz');
    expect(isValid).toBe(true);
  });

  it('blocks deletion of SuperAdmin in query middleware hook', async () => {
    const queryHooks = GetAllUsers.schema.s.hooks._pres.get('deleteOne') || [];
    const queryHook = queryHooks.find((h) => !h.isAsync && !h.query)?.fn || queryHooks[0]?.fn;

    const mockQuery = {
      getQuery: jest.fn().mockReturnValue({ email: 'vijayaraghavan130699@gmail.com' }),
      model: {
        findOne: jest.fn().mockResolvedValue({
          role: 'SuperAdmin',
          email: 'vijayaraghavan130699@gmail.com',
        }),
      },
    };

    if (queryHook) {
      await expect(queryHook.call(mockQuery)).rejects.toThrow(
        'Deletion prohibited: SuperAdmin account cannot be deleted.'
      );
    }
  });

  it('blocks deletion of SuperAdmin in document middleware hook', () => {
    const docHooks = GetAllUsers.schema.s.hooks._pres.get('deleteOne') || [];
    const docHook = docHooks[1]?.fn;

    const superAdminUser = {
      role: 'SuperAdmin',
      email: 'vijayaraghavan130699@gmail.com',
    };

    if (docHook) {
      expect(() => docHook.call(superAdminUser)).toThrow(
        'Deletion prohibited: SuperAdmin account cannot be deleted.'
      );
    }
  });
});
