import { jest } from '@jest/globals';
import Role from '../../models/roles/roles.model.js';
import {
  applyRoleProperties,
  buildRoleFilter,
  checkDuplicateRoleName,
  findActiveRole,
  getAllRoles,
  createRole,
  exportRoles,
} from './roles.controller.js';

const query = (result) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  send: jest.fn(),
});
afterEach(() => jest.restoreAllMocks());

it.each(['false', 'unknown'])('handles inactive and unrecognized role status: %s', (status) => {
  expect(buildRoleFilter({ status }).isActive).toBe(status === 'false' ? false : undefined);
});

it('normalizes missing duplicate lookup names and identifiers', async () => {
  const chain = query(null);
  jest.spyOn(Role, 'findOne').mockReturnValue(chain);
  expect(await checkDuplicateRoleName(undefined)).toBeNull();
  expect(findActiveRole()).toBe(chain);
});

it('preserves system-role fields and ignores absent updates', () => {
  const role = {
    name: 'Taskflow Admin',
    isSystem: true,
    roleType: 'Taskflow Admin',
    isActive: true,
    permissions: ['*'],
  };
  applyRoleProperties(role, {});
  applyRoleProperties(role, { roleType: 'Custom', isActive: false, permissions: null });
  expect(role).toEqual({
    name: 'Taskflow Admin',
    isSystem: true,
    roleType: 'Taskflow Admin',
    isActive: true,
    permissions: ['*'],
  });
});

it('defaults pagination and identifiers on legacy roles', async () => {
  jest.spyOn(Role, 'find').mockReturnValue(query([{}]));
  jest.spyOn(Role, 'countDocuments').mockResolvedValue(0);
  const res = response();
  await getAllRoles({ query: {} }, res);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ data: [{ roleId: 'RL0001', isActive: true }] })
  );
});

it.each([undefined, 'invalid'])(
  'creates a role with default fields and normalized permissions: %s',
  async (permissions) => {
    jest.spyOn(Role, 'findOne').mockReturnValue(query(null));
    jest.spyOn(Role, 'create').mockResolvedValue({ name: 'Reviewer' });
    const res = response();
    await createRole({ body: { name: 'Reviewer', permissions } }, res);
    expect(Role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '',
        roleType: 'Custom',
        permissions: [],
        isActive: true,
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  }
);

it('exports legacy records with safe defaults and applies filters', async () => {
  jest.spyOn(Role, 'find').mockReturnValue(query([{ _id: 'r1', isActive: false }, {}]));
  const res = response();
  await exportRoles({ query: { search: ' a ', roleType: 'Custom', status: 'false' } }, res);
  const payload = res.json.mock.calls[0][0];
  expect(JSON.stringify(payload)).toContain('N/A');
  expect(JSON.stringify(payload)).toContain('Inactive');
  expect(Role.find).toHaveBeenCalledWith(
    expect.objectContaining({ roleType: 'Custom', isActive: false })
  );
});
