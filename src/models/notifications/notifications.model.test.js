import { jest } from '@jest/globals';
import Notification, { getNextNotificationId } from './notifications.model.js';

describe('Notification Model', () => {
  it('should generate sequential notificationId', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ notificationId: 'NT0012' }),
          }),
        }),
      }),
    };

    const nextId = await getNextNotificationId(mockModel);
    expect(nextId).toBe('NT0013');
  });

  it('should return NT0001 if no prior notification exists', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextNotificationId(mockModel);
    expect(nextId).toBe('NT0001');
  });

  it('should return NT0001 on error', async () => {
    const mockModel = {
      findOne: jest.fn().mockImplementation(() => {
        throw new Error('DB Error');
      }),
    };

    const nextId = await getNextNotificationId(mockModel);
    expect(nextId).toBe('NT0001');
  });
  it('defaults notifications to an unread broadcast', async () => {
    const notification = new Notification({
      type: 'user_created',
      title: 'Welcome',
      message: 'Joined',
    });
    await expect(notification.validate()).resolves.toBeUndefined();
    expect(notification.targetRole).toBe('All');
    expect(notification.readBy).toEqual([]);
    expect(notification.isDeleted).toBe(false);
  });
});
