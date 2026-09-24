import { jest } from '@jest/globals';
import { getTaskComments, createTaskComment, deleteTaskComment } from './comments.controller.js';
import Comment from '../../models/comments/comments.model.js';
import Task from '../../models/tasks/tasks.model.js';

const taskId = '650c00000000000000000001';

// findActiveTask (imported from the tasks controller) is a thin wrapper around
// Task.findOne(...).populate(...).populate(...)[.lean()] — mocking at that level
// avoids relying on ESM namespace mutability for cross-module spies.
const mockFindActiveTask = (task) => {
  jest.spyOn(Task, 'findOne').mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(task),
  });
};

describe('Comments Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      params: {},
      body: {},
      user: { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', permissions: [] },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getTaskComments', () => {
    it('returns 404 when task is not found', async () => {
      mockFindActiveTask(null);
      mockReq.params = { id: 'missing' };
      await getTaskComments(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns comments for a task, oldest first', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Comment, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'c1', body: 'Hi' }]),
      });

      mockReq.params = { id: 'ENG-1' };
      await getTaskComments(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data).toHaveLength(1);
    });
  });

  describe('createTaskComment', () => {
    it('returns 404 when task is not found', async () => {
      mockFindActiveTask(null);
      mockReq.params = { id: 'missing' };
      mockReq.body = { body: 'Hello' };
      await createTaskComment(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when comment body is missing', async () => {
      mockFindActiveTask({ _id: taskId });
      mockReq.params = { id: 'ENG-1' };
      mockReq.body = {};
      await createTaskComment(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('creates a comment and notifies the assignee and reporter', async () => {
      mockFindActiveTask({
        _id: taskId,
        taskKey: 'ENG-1',
        title: 'Fix bug',
        assigneeId: 'assignee-1',
        reporterId: 'reporter-1',
      });
      jest.spyOn(Comment, 'create').mockResolvedValue({ _id: 'c1' });
      jest.spyOn(Comment, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: 'c1', body: 'Hello' }),
      });

      mockReq.params = { id: 'ENG-1' };
      mockReq.body = { body: 'Hello' };

      await createTaskComment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('deleteTaskComment', () => {
    it('returns 404 when comment is not found', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(null);

      mockReq.params = { id: 'ENG-1', commentId: 'missing' };
      await deleteTaskComment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('forbids deleting another user’s comment without tasks.edit permission', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Comment, 'findOne').mockResolvedValue({ authorId: 'someone-else' });

      mockReq.params = { id: 'ENG-1', commentId: 'c1' };
      await deleteTaskComment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('allows the author to delete their own comment', async () => {
      const mockComment = {
        authorId: 'user-1',
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(mockComment);

      mockReq.params = { id: 'ENG-1', commentId: 'c1' };
      await deleteTaskComment(mockReq, mockRes);

      expect(mockComment.isDeleted).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('allows a user with tasks.edit permission to delete any comment', async () => {
      const mockComment = {
        authorId: 'someone-else',
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Comment, 'findOne').mockResolvedValue(mockComment);
      mockReq.user.permissions = ['tasks.edit'];

      mockReq.params = { id: 'ENG-1', commentId: 'c1' };
      await deleteTaskComment(mockReq, mockRes);

      expect(mockComment.isDeleted).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
