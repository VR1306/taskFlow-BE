import { jest } from '@jest/globals';
import ActivityLog, { getNextActivityId } from './activity.model.js';

describe('ActivityLog Model', () => {
  it('should generate sequential activityId', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ activityId: 'ACT0010' }),
          }),
        }),
      }),
    };

    const nextId = await getNextActivityId(mockModel);
    expect(nextId).toBe('ACT0011');
  });

  it('should return ACT0001 if no prior activity exists', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextActivityId(mockModel);
    expect(nextId).toBe('ACT0001');
  });

  it('should return ACT0001 on error', async () => {
    const mockModel = {
      findOne: jest.fn().mockImplementation(() => {
        throw new Error('DB Error');
      }),
    };

    const nextId = await getNextActivityId(mockModel);
    expect(nextId).toBe('ACT0001');
  });

  it('instantiates activity log model with schema fields', () => {
    const activity = new ActivityLog({
      taskId: '650c00000000000000000001',
      actorId: '650c00000000000000000002',
      actorName: 'Jane Doe',
      action: 'status_changed',
      fromValue: 'Todo',
      toValue: 'In Progress',
      message: 'Status changed from Todo to In Progress.',
    });

    expect(activity.action).toBe('status_changed');
    expect(activity.message).toBe('Status changed from Todo to In Progress.');
  });
});
