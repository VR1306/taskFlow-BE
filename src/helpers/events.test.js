import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import Notification from '../models/notifications/notifications.model.js';
import ActivityLog from '../models/activity/activity.model.js';
import Role from '../models/roles/roles.model.js';
import { createNotification } from './notification.helper.js';
import { logActivity } from './activity.helper.js';
import { getPermissionsForRole, hasPermission, requirePermission } from './permissions.helper.js';

afterEach(() => jest.restoreAllMocks());

describe.each([
  [
    'notification',
    Notification,
    createNotification,
    { type: 'user_created', title: 'Welcome', message: 'Joined' },
  ],
  [
    'activity',
    ActivityLog,
    logActivity,
    { taskId: 'task-1', action: 'created', message: 'Created' },
  ],
])('%s persistence', (_name, Model, record, params) => {
  it('does not buffer writes while disconnected', async () => {
    expect(await record(params)).toBeNull();
  });

  it.each([
    [undefined, null, 'System'],
    [
      { _id: 'u1', firstName: 'Ada', lastName: 'Lovelace', role: 'Developer' },
      'u1',
      'Ada Lovelace',
    ],
    [{ id: 'u2', name: 'Grace' }, 'u2', 'Grace'],
    [{ email: 'user@example.com' }, null, 'user@example.com'],
    [{}, null, 'User'],
  ])('persists actor identity for %j', async (actor, actorId, actorName) => {
    const saved = { id: 'event-1' };
    jest.spyOn(Model, 'create').mockResolvedValue(saved);
    expect(await record({ ...params, actor })).toBe(saved);
    expect(Model.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...params, actorId, actorName })
    );
  });

  it('preserves explicitly supplied event details', async () => {
    jest.spyOn(Model, 'create').mockResolvedValue({ id: 'event-1' });
    await record({
      ...params,
      recipientId: 'u3',
      targetRole: 'QA',
      metadata: { source: 'test' },
      fromValue: 'Todo',
      toValue: 'Done',
    });
    const details = Model.create.mock.calls[0][0];
    if (Model === Notification) {
      expect(details).toMatchObject({
        recipientId: 'u3',
        targetRole: 'QA',
        metadata: { source: 'test' },
      });
    } else {
      expect(details).toMatchObject({ fromValue: 'Todo', toValue: 'Done' });
    }
  });

  it('contains persistence failures without rejecting the primary operation', async () => {
    jest.spyOn(Model, 'create').mockRejectedValue(new Error('Unavailable'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await record(params)).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.any(String), 'Unavailable');
  });
});

describe('permission enforcement', () => {
  it.each([undefined, '', null])('returns no grants for a missing role: %s', async (role) => {
    expect(await getPermissionsForRole(role)).toEqual([]);
  });

  it('does not query a disconnected database', async () => {
    expect(mongoose.connection.readyState).toBe(0);
    expect(await getPermissionsForRole('Developer')).toEqual([]);
  });

  it.each([null, {}, { permissions: ['tasks.view'] }])(
    'resolves a role lookup: %j',
    async (role) => {
      jest.spyOn(Role, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(role) });
      expect(await getPermissionsForRole('Developer')).toEqual(role?.permissions || []);
      expect(Role.findOne).toHaveBeenCalledWith({ name: 'Developer', isDeleted: { $ne: true } });
    }
  );

  it('fails closed when role lookup rejects', async () => {
    jest
      .spyOn(Role, 'findOne')
      .mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('Offline')) });
    expect(await getPermissionsForRole('Developer')).toEqual([]);
  });

  it.each([undefined, {}, { permissions: 'tasks.view' }, { permissions: [] }])(
    'denies missing grants: %j',
    (user) => {
      expect(hasPermission(user, 'tasks.view')).toBe(false);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requirePermission('tasks.view')({ user }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(next).not.toHaveBeenCalled();
    }
  );

  it('continues authorized requests', () => {
    const user = { permissions: ['tasks.view'] };
    const next = jest.fn();
    expect(hasPermission(user, 'tasks.view')).toBe(true);
    requirePermission('tasks.view')({ user }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
