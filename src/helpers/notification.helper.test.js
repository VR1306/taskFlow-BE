import { jest } from '@jest/globals';
import { createNotification, notifyUsers } from './notification.helper.js';
import Notification from '../models/notifications/notifications.model.js';

describe('notifyUsers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fans out one notification per unique recipient, deduping and dropping falsy entries', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    await notifyUsers({
      recipientIds: ['user-1', 'user-2', 'user-1', null, undefined],
      actor: { _id: 'actor-1', firstName: 'Ada' },
      type: 'project_member_added',
      title: 'Added to Project',
      message: 'You were added.',
      metadata: { projectId: 'proj-1' },
    });

    expect(create).toHaveBeenCalledTimes(2);
    const recipientIdsCalled = create.mock.calls.map((call) => call[0].recipientId).sort();
    expect(recipientIdsCalled).toEqual(['user-1', 'user-2']);
  });

  it('excludes the acting user from the recipient list by default', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    await notifyUsers({
      recipientIds: ['actor-1', 'user-2'],
      actor: { _id: 'actor-1' },
      type: 'task_deleted',
      title: 'Task Deleted',
      message: 'Deleted.',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].recipientId).toBe('user-2');
  });

  it('accepts populated user objects as recipients', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    await notifyUsers({
      recipientIds: [{ _id: 'user-9' }],
      type: 'project_updated',
      title: 'Project Updated',
      message: 'Updated.',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].recipientId).toBe('user-9');
  });

  it('does nothing when there are no valid recipients', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    const result = await notifyUsers({
      recipientIds: [null, undefined],
      type: 'project_deleted',
      title: 'Project Deleted',
      message: 'Deleted.',
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('defaults to an empty recipient list when none are given', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    const noRecipients = await notifyUsers({
      type: 'project_deleted',
      title: 'Project Deleted',
      message: 'Deleted.',
    });

    expect(create).not.toHaveBeenCalled();
    expect(noRecipients).toEqual([]);
  });

  it('falls back to actor.id, then an empty string, when actor._id is absent', async () => {
    const create = jest.spyOn(Notification, 'create').mockResolvedValue({});

    await notifyUsers({
      recipientIds: ['actor-2', 'user-3'],
      actor: { id: 'actor-2' },
      type: 'project_deleted',
      title: 'Project Deleted',
      message: 'Deleted.',
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].recipientId).toBe('user-3');

    create.mockClear();
    await notifyUsers({
      recipientIds: ['user-4'],
      actor: {},
      type: 'project_deleted',
      title: 'Project Deleted',
      message: 'Deleted.',
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].recipientId).toBe('user-4');
  });
});

describe('createNotification', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns null and swallows errors when persistence fails', async () => {
    jest.spyOn(Notification, 'create').mockRejectedValue(new Error('db down'));
    const result = await createNotification({
      type: 'project_updated',
      title: 'Title',
      message: 'Message',
    });
    expect(result).toBeNull();
  });

  it('retries on a notificationId collision (from a racing concurrent create) and succeeds', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
    const create = jest
      .spyOn(Notification, 'create')
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValueOnce({ notificationId: 'NT0011' });

    const result = await createNotification({
      type: 'project_updated',
      title: 'Title',
      message: 'Message',
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ notificationId: 'NT0011' });
  });

  it('gives up and returns null after exhausting retries on repeated id collisions', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
    const create = jest.spyOn(Notification, 'create').mockRejectedValue(duplicateKeyError);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createNotification({
      type: 'project_updated',
      title: 'Title',
      message: 'Message',
    });

    expect(create).toHaveBeenCalledTimes(4);
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});
