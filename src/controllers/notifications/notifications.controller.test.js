import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  buildNotificationFilter,
  buildNotificationLink,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from './notifications.controller.js';
import Notification from '../../models/notifications/notifications.model.js';
import Project from '../../models/projects/projects.model.js';

describe('Notifications Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Project, 'find').mockReturnValue({ distinct: jest.fn().mockResolvedValue([]) });
    req = {
      user: {
        _id: new mongoose.Types.ObjectId('650c00000000000000000001'),
        id: '650c00000000000000000001',
        role: 'Taskflow Admin',
        firstName: 'Taskflow',
        lastName: 'Admin',
      },
      query: {},
      params: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildNotificationFilter', () => {
    it('provides global feed for Taskflow Admin', async () => {
      const filter = await buildNotificationFilter({ user: req.user });
      expect(filter.isDeleted).toEqual({ $ne: true });
      expect(filter.$or).toBeUndefined();
      expect(Project.find).not.toHaveBeenCalled();
    });

    it('scopes notifications for Project Manager to their role, personal recipient targets, and non-project broadcasts', async () => {
      const pmUser = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000002'),
        role: 'Project Manager',
      };

      const filter = await buildNotificationFilter({ user: pmUser });
      expect(filter.isDeleted).toEqual({ $ne: true });
      expect(filter.$or).toEqual(
        expect.arrayContaining([
          { recipientId: pmUser._id },
          {
            targetRole: { $in: ['All', 'Project Manager'] },
            'metadata.projectId': { $exists: false },
          },
        ])
      );
    });

    it('scopes notifications for Developer to their role and personal recipient targets', async () => {
      const devUser = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000003'),
        role: 'Developer',
      };

      const filter = await buildNotificationFilter({ user: devUser });
      expect(filter.isDeleted).toEqual({ $ne: true });
      expect(filter.$or).toEqual(
        expect.arrayContaining([
          { recipientId: devUser._id },
          { targetRole: { $in: ['All', 'Developer'] }, 'metadata.projectId': { $exists: false } },
        ])
      );
    });

    it('includes only projects the user belongs to in the project-scoped broadcast clause', async () => {
      const devUser = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000003'),
        role: 'Developer',
      };
      const distinct = jest.fn().mockResolvedValue(['proj-1', 'proj-2']);
      jest.spyOn(Project, 'find').mockReturnValue({ distinct });

      const filter = await buildNotificationFilter({ user: devUser });

      expect(Project.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [{ members: devUser._id }, { leadId: devUser._id }],
        })
      );
      expect(filter.$or).toEqual(
        expect.arrayContaining([
          {
            targetRole: { $in: ['All', 'Developer'] },
            'metadata.projectId': { $in: ['proj-1', 'proj-2'] },
          },
        ])
      );
    });
  });

  describe('buildNotificationLink', () => {
    it('links task notifications to the project board, with the task id when known', () => {
      expect(buildNotificationLink('task_assigned', { projectId: 'p1', taskId: 't1' })).toBe(
        '/projects/p1?taskId=t1'
      );
      expect(buildNotificationLink('task_deleted', { projectId: 'p1' })).toBe('/projects/p1');
      expect(buildNotificationLink('task_assigned', {})).toBeNull();
    });

    it('links project notifications to the project, except deletions which go to the list', () => {
      expect(buildNotificationLink('project_updated', { projectId: 'p1' })).toBe('/projects/p1');
      expect(buildNotificationLink('project_deleted', { projectId: 'p1' })).toBe('/projects');
      expect(buildNotificationLink('project_created', {})).toBe('/projects');
    });

    it('links user notifications to the users list and returns null for unknown types', () => {
      expect(buildNotificationLink('user_created', {})).toBe('/users');
      expect(buildNotificationLink('something_else', {})).toBeNull();
    });
  });

  describe('getNotifications', () => {
    it('retrieves paginated notifications and flags isRead properly', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000050'),
        notificationId: 'NT0001',
        title: 'New Member Added',
        message: 'Alex joined the team',
        type: 'user_created',
        actorName: 'Admin User',
        readBy: [{ userId: req.user._id, readAt: new Date() }],
        createdAt: new Date(),
      };

      jest.spyOn(Notification, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([mockDoc]),
              }),
            }),
          }),
        }),
      });
      jest.spyOn(Notification, 'countDocuments').mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: expect.objectContaining({ totalItems: 1, unreadCount: 0 }),
          data: expect.arrayContaining([expect.objectContaining({ isRead: true })]),
        })
      );
    });
  });

  describe('getUnreadNotificationsCount', () => {
    it('returns unread count', async () => {
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(4);

      await getUnreadNotificationsCount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { unreadCount: 4 },
      });
    });
  });

  describe('markNotificationAsRead', () => {
    it('adds current user to readBy array', async () => {
      req.params = { id: '650c00000000000000000050' };
      const mockDoc = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000050'),
        readBy: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Notification, 'findOne').mockResolvedValue(mockDoc);

      await markNotificationAsRead(req, res);

      expect(mockDoc.readBy).toHaveLength(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('updates all matching unread notifications', async () => {
      jest.spyOn(Notification, 'updateMany').mockResolvedValue({ modifiedCount: 3 });

      await markAllNotificationsAsRead(req, res);

      expect(Notification.updateMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'All notifications marked as read.' })
      );
    });
  });
  it.each(['NT0001', '650c00000000000000000050'])('soft deletes notification %s', async (id) => {
    req.params.id = id;
    const doc = { _id: 'db-id', save: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(Notification, 'findOne').mockResolvedValue(doc);
    await deleteNotification(req, res);
    expect(doc.isDeleted).toBe(true);
    expect(doc.deletedAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { id: 'db-id' } })
    );
  });

  it.each([deleteNotification, markNotificationAsRead])(
    'returns 404 for a missing notification',
    async (handler) => {
      req.params.id = 'NT404';
      jest.spyOn(Notification, 'findOne').mockResolvedValue(null);
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Notification not found.' });
    }
  );

  it('does not save or duplicate an existing read receipt', async () => {
    req.params.id = 'NT0001';
    req.user = { id: 'user-1' };
    const doc = { _id: 'db-id', readBy: [{ userId: 'user-1' }], save: jest.fn() };
    jest.spyOn(Notification, 'findOne').mockResolvedValue(doc);
    await markNotificationAsRead(req, res);
    expect(doc.readBy).toHaveLength(1);
    expect(doc.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each(['Taskflow Admin', 'Developer'])(
    'combines escaped search with role scope for %s',
    async (role) => {
      const user = { id: 'user-1', role };
      const filter = await buildNotificationFilter({
        user,
        search: '  a.b  ',
        type: ' user_created ',
        unreadOnly: true,
      });
      const searchConditions = role === 'Developer' ? filter.$and[1].$or : filter.$or;
      expect(searchConditions[0].title.test('a.b')).toBe(true);
      expect(searchConditions[0].title.test('axb')).toBe(false);
      expect(filter.type).toBe('user_created');
      expect(filter['readBy.userId']).toEqual({ $ne: 'user-1' });
      if (role === 'Developer') {
        expect(filter.$and[0].$or[0]).toEqual({ recipientId: 'user-1' });
        expect(filter.$or).toBeUndefined();
      }
    }
  );
  it('serializes populated actors and missing actor details with explicit filters', async () => {
    req.user = { id: 'user-1', role: 'Developer' };
    req.query = { search: 'Welcome', type: 'user_created', unread: true, page: '2', limit: '10' };
    const docs = [
      {
        _id: 'n1',
        actorId: {
          _id: 'actor-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          role: 'Developer',
        },
        readBy: [{ userId: 'other' }, {}],
      },
      { _id: 'n2', actorId: {}, readBy: null },
    ];
    jest.spyOn(Notification, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(docs),
    });
    jest.spyOn(Notification, 'countDocuments').mockResolvedValue(0);
    await getNotifications(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ totalPages: 1 }),
        data: expect.arrayContaining([
          expect.objectContaining({
            actor: { id: '', name: '', email: '', role: '' },
            isRead: false,
          }),
        ]),
      })
    );
    jest.spyOn(Notification, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
    await markAllNotificationsAsRead({ user: req.user }, res);
  });
});
