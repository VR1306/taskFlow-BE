import { jest } from '@jest/globals';
import GetAllUsers from '../models/users/users.model.js';
import { seedSuperAdmin } from './seedAdmin.js';

describe('seedSuperAdmin Helper Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not create a super admin if one already exists', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue({
      email: 'vijayaraghavan130699@gmail.com',
      role: 'SuperAdmin',
    });
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockResolvedValue({});

    await seedSuperAdmin();

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should create a super admin if none exists', async () => {
    jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(GetAllUsers, 'create').mockResolvedValue({
      email: 'vijayaraghavan130699@gmail.com',
      role: 'SuperAdmin',
    });

    await seedSuperAdmin();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'vijayaraghavan130699@gmail.com',
        role: 'SuperAdmin',
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
