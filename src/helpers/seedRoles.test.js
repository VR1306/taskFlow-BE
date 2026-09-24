import { jest } from '@jest/globals';
import Role from '../models/roles/roles.model.js';
import { DEFAULT_SEED_ROLES } from '../constants/permissions/permissions.constants.js';
import { seedDefaultRoles } from './seedRoles.js';
import { seedSuperAdmin } from './seedAdmin.js';

afterEach(() => jest.restoreAllMocks());

it('creates missing default roles with stable identifiers and permissions', async () => {
  jest.spyOn(Role, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  const create = jest.spyOn(Role, 'create').mockResolvedValue({});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await seedDefaultRoles();
  expect(create).toHaveBeenCalledTimes(DEFAULT_SEED_ROLES.length);
  DEFAULT_SEED_ROLES.forEach((role, index) => {
    expect(create).toHaveBeenNthCalledWith(
      index + 1,
      expect.objectContaining({
        name: role.name,
        roleId: `RL${String(index + 1).padStart(4, '0')}`,
        permissions: role.permissions,
      })
    );
  });
});

it('contains role seeding failures', async () => {
  jest
    .spyOn(Role, 'findOne')
    .mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('Offline')) });
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  await seedDefaultRoles();
  expect(error).toHaveBeenCalledWith('Role seeding warning:', 'Offline');
});

it('skips account seeding without a database connection', async () => {
  await expect(seedSuperAdmin()).resolves.toBeUndefined();
});
