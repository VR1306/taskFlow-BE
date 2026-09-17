import { jest } from '@jest/globals';
import GetAllUsers from '../models/users/users.model.js';
import { seedSuperAdmin, SEED_USERS } from './seedAdmin.js';

describe('seedSuperAdmin Helper Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should export SEED_USERS in sequential order with SuperAdmin and Test User', () => {
    expect(SEED_USERS).toHaveLength(2);
    expect(SEED_USERS[0].userId).toBe('TF0001');
    expect(SEED_USERS[0].role).toBe('SuperAdmin');
    expect(SEED_USERS[1].userId).toBe('TF0002');
    expect(SEED_USERS[1].role).toBe('User');
  });

  it('should not create users if all already exist with userId', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockImplementation(({ email }) => {
      const match = SEED_USERS.find((u) => u.email === email);
      return Promise.resolve(match ? { ...match } : null);
    });
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockResolvedValue({});
    const updateSpy = jest.spyOn(GetAllUsers, 'updateOne').mockResolvedValue({});

    await seedSuperAdmin();

    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should update user with userId if one exists without userId', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue({
      email: 'vijayaraghavan130699@gmail.com',
      role: 'SuperAdmin',
    });
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockResolvedValue({});
    const updateSpy = jest.spyOn(GetAllUsers, 'updateOne').mockResolvedValue({});

    await seedSuperAdmin();

    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(
      { email: 'vijayaraghavan130699@gmail.com' },
      { $set: { userId: 'TF0001' } }
    );
  });

  it('should create seed accounts in order if none exist', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockResolvedValue({});

    await seedSuperAdmin();

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'TF0001',
        email: 'vijayaraghavan130699@gmail.com',
        role: 'SuperAdmin',
      })
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'TF0002',
        email: 'testuser@taskflow.com',
        role: 'User',
      })
    );
  });

  it('should catch and log error gracefully when findOne fails', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockRejectedValue(new Error('DB Query Failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await seedSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error seeding SuperAdmin:', 'DB Query Failed');
  });
});
