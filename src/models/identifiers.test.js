import { jest } from '@jest/globals';
import Activity, { getNextActivityId } from './activity/activity.model.js';
import Attachment, { getNextAttachmentId } from './attachments/attachments.model.js';
import Comment, { getNextCommentId } from './comments/comments.model.js';
import Notification, { getNextNotificationId } from './notifications/notifications.model.js';
import Project, { getNextProjectId } from './projects/projects.model.js';
import Role, { getNextRoleId } from './roles/roles.model.js';
import User, { getNextUserId } from './users/users.model.js';

afterEach(() => jest.restoreAllMocks());

const cases = [
  [Activity, getNextActivityId, 'activityId', 'ACT'],
  [Attachment, getNextAttachmentId, 'attachmentId', 'ATT'],
  [Comment, getNextCommentId, 'commentId', 'CMT'],
  [Notification, getNextNotificationId, 'notificationId', 'NT'],
  [Project, getNextProjectId, 'projectId', 'PRJ'],
  [Role, getNextRoleId, 'roleId', 'RL'],
  [User, getNextUserId, 'userId', 'TF'],
];

describe.each(cases)('%s identifiers', (Model, nextId, field, prefix) => {
  it.each([null, {}, { invalid: true }])(
    'starts the sequence for missing or malformed identifiers: %j',
    async (previous) => {
      const doc = previous?.invalid ? { [field]: 'invalid' } : previous;
      const query = {
        sort: jest.fn().mockReturnThis(),
        collation: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(doc),
      };
      jest.spyOn(Model, 'findOne').mockReturnValue(query);
      expect(await nextId(Model)).toBe(`${prefix}0001`);
    }
  );

  it('contains lookup failures', async () => {
    jest.spyOn(Model, 'findOne').mockImplementation(() => {
      throw new Error('Offline');
    });
    expect(await nextId(Model)).toBe(`${prefix}0001`);
  });
});

describe.each(cases.filter(([Model]) => Model !== Role && Model !== User))(
  '%s save identifiers',
  (Model, _nextId, field, prefix) => {
    it.each([false, true])(
      'assigns an identifier only when absent (existing: %s)',
      async (existing) => {
        const find = jest.spyOn(Model, 'findOne').mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          collation: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(null),
        });
        const doc = new Model({ [field]: existing ? `${prefix}0042` : undefined });
        for (const hook of Model.schema.s.hooks._pres.get('save')) {
          await hook.fn.call(doc);
        }
        expect(doc[field]).toBe(existing ? `${prefix}0042` : `${prefix}0001`);
        expect(find).toHaveBeenCalledTimes(existing ? 0 : 1);
      }
    );
  }
);

describe('protected role deletion', () => {
  it.each([{ isSystem: true }, { name: 'Taskflow Admin' }])(
    'rejects deletion of %j',
    async (role) => {
      const query = {
        model: { findOne: jest.fn().mockResolvedValue(role) },
        getQuery: () => ({ roleId: 'RL0001' }),
      };
      const hook = Role.schema.s.hooks._pres.get('deleteOne')[0].fn;
      await expect(hook.call(query)).rejects.toThrow('System protected roles cannot be deleted');
    }
  );

  it.each([null, { name: 'Custom', isSystem: false }])(
    'allows unprotected query results: %j',
    async (role) => {
      const query = {
        model: { findOne: jest.fn().mockResolvedValue(role) },
        getQuery: () => ({ roleId: 'RL0002' }),
      };
      const hook = Role.schema.s.hooks._pres.get('deleteOne')[0].fn;
      await expect(hook.call(query)).resolves.toBeUndefined();
    }
  );
});
