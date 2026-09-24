import { jest } from '@jest/globals';
import GetAllUsers from '../models/users/users.model.js';
import { seedSuperAdmin, SEED_USERS } from './seedAdmin.js';

describe('seedSuperAdmin Helper Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should export SEED_USERS in sequential order with Taskflow Admin, Project Manager, and Developer', () => {
    expect(SEED_USERS).toHaveLength(3);
    expect(SEED_USERS[0].userId).toBe('TF0001');
    expect(SEED_USERS[0].role).toBe('Taskflow Admin');
    expect(SEED_USERS[1].userId).toBe('TF0002');
    expect(SEED_USERS[1].role).toBe('Project Manager');
    expect(SEED_USERS[2].userId).toBe('TF0003');
    expect(SEED_USERS[2].role).toBe('Developer');
  });

  it('should not create users if all already exist with userId', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockImplementation(({ email }) => {
      const match = SEED_USERS.find((u) => u.email === email);
      return Promise.resolve(match ? { ...match, save: jest.fn().mockResolvedValue(true) } : null);
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
      role: 'Taskflow Admin',
      save: jest.fn().mockResolvedValue(true),
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

  it('should create seed accounts if none exist', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockImplementation((data) =>
      Promise.resolve({
        ...data,
        _id: '650c00000000000000000011',
        save: jest.fn().mockResolvedValue(true),
      })
    );

    await seedSuperAdmin();

    expect(createSpy).toHaveBeenCalledTimes(3);
  });

  it('should catch and log error gracefully when findOne fails', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockRejectedValue(new Error('DB Query Failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await seedSuperAdmin();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error seeding default accounts:',
      'DB Query Failed'
    );
  });
});
