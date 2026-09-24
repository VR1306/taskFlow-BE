import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  buildTaskFilter,
  getAllTasks,
  getBoardTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskActivity,
  getTaskCounters,
} from './tasks.controller.js';
import Task from '../../models/tasks/tasks.model.js';
import Project from '../../models/projects/projects.model.js';
import Notification from '../../models/notifications/notifications.model.js';
import Comment from '../../models/comments/comments.model.js';
import Attachment from '../../models/attachments/attachments.model.js';
import ActivityLog from '../../models/activity/activity.model.js';

const projectId = '650c00000000000000000001';
const taskDocId = '650c00000000000000000099';

describe('Tasks Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      params: {},
      user: { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', role: 'Developer' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  describe('buildTaskFilter', () => {
    it('returns default filter with no params', () => {
      expect(buildTaskFilter({})).toEqual({ isDeleted: { $ne: true } });
    });

    it('applies projectId, status, priority, and type filters when valid', () => {
      const filter = buildTaskFilter({
        projectId,
        status: 'Done',
        priority: 'High',
        type: 'Bug',
      });
      expect(filter.projectId).toBe(projectId);
      expect(filter.status).toBe('Done');
      expect(filter.priority).toBe('High');
      expect(filter.type).toBe('Bug');
    });

    it('ignores invalid enum values', () => {
      const filter = buildTaskFilter({ status: 'Blocked', priority: 'Extreme', type: 'Epic' });
      expect(filter.status).toBeUndefined();
      expect(filter.priority).toBeUndefined();
      expect(filter.type).toBeUndefined();
    });

    it('builds a search regex filter', () => {
      const filter = buildTaskFilter({ search: 'login' });
      expect(filter.$or).toHaveLength(3);
    });
  });

  describe('getBoardTasks', () => {
    it('returns 400 when projectId is missing or invalid', async () => {
      mockReq.query = {};
      await getBoardTasks(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns board tasks sorted by status/order', async () => {
      const mockTasks = [{ _id: new mongoose.Types.ObjectId(taskDocId), title: 'Task A' }];
      jest.spyOn(Task, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });

      mockReq.query = { projectId };
      await getBoardTasks(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data).toHaveLength(1);
    });
  });

  describe('getAllTasks', () => {
    it('returns paginated tasks', async () => {
      const mockTasks = [{ _id: new mongoose.Types.ObjectId(taskDocId), title: 'Task A' }];
      jest.spyOn(Task, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks),
      });
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(1);

      await getAllTasks(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.pagination.totalItems).toBe(1);
    });
  });

  describe('getTaskById', () => {
    it('returns 404 when task is not found', async () => {
      jest.spyOn(Task, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      mockReq.params = { id: 'ENG-999' };
      await getTaskById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns task details when found by key', async () => {
      const mockTask = { _id: new mongoose.Types.ObjectId(taskDocId), taskKey: 'ENG-1' };
      jest.spyOn(Task, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTask),
      });

      mockReq.params = { id: 'eng-1' };
      await getTaskById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('createTask', () => {
    it('returns 400 when projectId is invalid', async () => {
      mockReq.body = { title: 'New task' };
      await createTask(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when title is missing', async () => {
      mockReq.body = { projectId };
      await createTask(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when project does not exist', async () => {
      jest.spyOn(Project, 'findOneAndUpdate').mockResolvedValue(null);
      mockReq.body = { projectId, title: 'New task' };
      await createTask(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('creates a task with a generated taskKey and default ordering', async () => {
      jest.spyOn(Project, 'findOneAndUpdate').mockResolvedValue({
        _id: projectId,
        key: 'ENG',
        taskSequence: 3,
      });
      jest.spyOn(Task, 'findOne').mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ order: 1 }),
      });
      const createdTask = {
        _id: new mongoose.Types.ObjectId(taskDocId),
        taskKey: 'ENG-3',
        title: 'New task',
      };
      const createSpy = jest.spyOn(Task, 'create').mockResolvedValue(createdTask);
      jest.spyOn(Task, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(createdTask),
      });

      mockReq.body = { projectId, title: 'New task' };
      await createTask(mockReq, mockRes);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ taskKey: 'ENG-3', title: 'New task', order: 2, status: 'Todo' })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateTask', () => {
    it('returns 404 when task is not found', async () => {
      jest.spyOn(Task, 'findOne').mockResolvedValue(null);
      mockReq.params = { id: 'missing' };
      await updateTask(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('updates simple fields and logs a priority change', async () => {
      const mockTaskDoc = {
        _id: taskDocId,
        taskKey: 'ENG-1',
        title: 'Old title',
        priority: 'Medium',
        assigneeId: null,
        labels: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest
        .spyOn(Task, 'findOne')
        .mockResolvedValueOnce(mockTaskDoc)
        .mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockTaskDoc),
        });
      const activitySpy = jest.spyOn(ActivityLog, 'create').mockResolvedValue({});

      mockReq.params = { id: 'ENG-1' };
      mockReq.body = { title: 'New title', priority: 'High' };

      await updateTask(mockReq, mockRes);

      expect(mockTaskDoc.title).toBe('New title');
      expect(mockTaskDoc.priority).toBe('High');
      expect(activitySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'priority_changed',
          fromValue: 'Medium',
          toValue: 'High',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateTaskStatus', () => {
    it('returns 400 for an invalid status', async () => {
      mockReq.body = { status: 'Blocked' };
      mockReq.params = { id: 'ENG-1' };
      await updateTaskStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when task is not found', async () => {
      jest.spyOn(Task, 'findOne').mockResolvedValue(null);
      mockReq.body = { status: 'Done' };
      mockReq.params = { id: 'missing' };
      await updateTaskStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('moves a task to a new column and logs a status_changed activity', async () => {
      const mockTaskDoc = {
        _id: taskDocId,
        taskKey: 'ENG-1',
        title: 'Task A',
        status: 'Todo',
        order: 0,
        reporterId: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest
        .spyOn(Task, 'findOne')
        .mockResolvedValueOnce(mockTaskDoc)
        .mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockTaskDoc),
        });
      const activitySpy = jest.spyOn(ActivityLog, 'create').mockResolvedValue({});

      mockReq.params = { id: 'ENG-1' };
      mockReq.body = { status: 'In Progress', order: 1 };

      await updateTaskStatus(mockReq, mockRes);

      expect(mockTaskDoc.status).toBe('In Progress');
      expect(mockTaskDoc.order).toBe(1);
      expect(activitySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'status_changed',
          fromValue: 'Todo',
          toValue: 'In Progress',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteTask', () => {
    it('returns 404 when task is not found', async () => {
      jest.spyOn(Task, 'findOne').mockResolvedValue(null);
      mockReq.params = { id: 'missing' };
      await deleteTask(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('soft deletes a task', async () => {
      const mockTaskDoc = {
        _id: taskDocId,
        taskKey: 'ENG-1',
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Task, 'findOne').mockResolvedValue(mockTaskDoc);

      mockReq.params = { id: 'ENG-1' };
      await deleteTask(mockReq, mockRes);

      expect(mockTaskDoc.isDeleted).toBe(true);
      expect(mockTaskDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getTaskActivity', () => {
    it('returns 404 when task is not found', async () => {
      jest.spyOn(Task, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      mockReq.params = { id: 'missing' };
      await getTaskActivity(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns the activity feed for a task', async () => {
      jest.spyOn(Task, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: taskDocId, taskKey: 'ENG-1' }),
      });
      jest.spyOn(ActivityLog, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'act-1', action: 'created' }]),
      });

      mockReq.params = { id: 'ENG-1' };
      await getTaskActivity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data).toHaveLength(1);
    });
  });
  it('uses scalar filters and ignores query operator objects', () => {
    expect(
      buildTaskFilter({
        projectId: { $ne: null },
        assigneeId: { $ne: null },
        status: { $ne: null },
      })
    ).toEqual({ isDeleted: { $ne: true } });
    expect(buildTaskFilter({ assigneeId: taskDocId }).assigneeId).toBe(taskDocId);
  });

  it.each([taskDocId, null, 'invalid'])('updates task assignment to %s', async (assigneeId) => {
    const task = {
      _id: taskDocId,
      taskKey: 'ENG-1',
      projectId,
      title: 'Task',
      assigneeId: '650c00000000000000000002',
      save: jest.fn(),
    };
    jest
      .spyOn(Task, 'findOne')
      .mockResolvedValueOnce(task)
      .mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(task),
      });
    jest.spyOn(ActivityLog, 'create').mockResolvedValue({});
    const notify = jest.spyOn(Notification, 'create').mockResolvedValue({});
    mockReq.params.id = taskDocId;
    mockReq.body = {
      assigneeId,
      description: ' details ',
      type: 'Bug',
      dueDate: null,
      labels: ['tag', 1],
    };
    await updateTask(mockReq, mockRes);
    expect(task.assigneeId).toBe(assigneeId === taskDocId ? taskDocId : null);
    expect(task.description).toBe('details');
    expect(task.labels).toEqual(['tag']);
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(assigneeId === taskDocId ? 1 : 0);
  });

  it('notifies the reporter when completing a task', async () => {
    const task = {
      _id: taskDocId,
      taskKey: 'ENG-1',
      projectId,
      title: 'Task',
      status: 'Todo',
      order: 4,
      reporterId: 'reporter-1',
      save: jest.fn(),
    };
    jest
      .spyOn(Task, 'findOne')
      .mockResolvedValueOnce(task)
      .mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(task),
      });
    jest.spyOn(ActivityLog, 'create').mockResolvedValue({});
    const notify = jest.spyOn(Notification, 'create').mockResolvedValue({});
    mockReq.params.id = taskDocId;
    mockReq.body = { status: 'Done' };
    await updateTaskStatus(mockReq, mockRes);
    expect(task.status).toBe('Done');
    expect(task.order).toBe(4);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 'reporter-1', type: 'task_completed' })
    );
  });

  it('aggregates comment and attachment totals for the requested tasks', async () => {
    jest.spyOn(Comment, 'aggregate').mockResolvedValue([{ _id: taskDocId, count: 2 }]);
    jest.spyOn(Attachment, 'aggregate').mockResolvedValue([{ _id: taskDocId, count: 1 }]);
    expect(await getTaskCounters([taskDocId])).toEqual({
      commentCounts: [{ _id: taskDocId, count: 2 }],
      attachmentCounts: [{ _id: taskDocId, count: 1 }],
    });
    expect(Comment.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: { taskId: { $in: [taskDocId] }, isDeleted: { $ne: true } } },
      ])
    );
  });
});
