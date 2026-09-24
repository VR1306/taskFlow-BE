import { jest } from '@jest/globals';
import Task from '../../models/tasks/tasks.model.js';
import Project from '../../models/projects/projects.model.js';
import Notification from '../../models/notifications/notifications.model.js';
import {
  findActiveTask,
  getAllTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from './tasks.controller.js';

const id = '650c00000000000000000001';
const query = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
afterEach(() => jest.restoreAllMocks());

it('builds a non-lean query for an empty identifier', () => {
  const chain = query(null);
  jest.spyOn(Task, 'findOne').mockReturnValue(chain);
  expect(findActiveTask()).toBe(chain);
  expect(Task.findOne).toHaveBeenCalledWith({ taskKey: '', isDeleted: { $ne: true } });
});

it('reports one empty page when no tasks match', async () => {
  jest.spyOn(Task, 'find').mockReturnValue(query([]));
  jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
  const res = response();
  await getAllTasks({ query: {} }, res);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ pagination: expect.objectContaining({ totalPages: 1 }) })
  );
});

it.each([id, 'invalid'])(
  'creates tasks with optional fields and validates assignee %s',
  async (assigneeId) => {
    jest.spyOn(Project, 'findOneAndUpdate').mockResolvedValue({ key: 'ENG', taskSequence: 1 });
    const task = { _id: id, taskKey: 'ENG-1', title: 'Task' };
    jest.spyOn(Task, 'findOne').mockReturnValueOnce(query(null)).mockReturnValue(query(task));
    jest.spyOn(Task, 'create').mockResolvedValue(task);
    jest.spyOn(Notification, 'create').mockResolvedValue({});
    const res = response();
    await createTask(
      {
        body: {
          projectId: id,
          title: 'Task',
          assigneeId,
          description: 'Details',
          type: 'Bug',
          priority: 'High',
          labels: ['label', 2],
          dueDate: '2026-10-01',
        },
      },
      res
    );
    expect(Task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ['label'],
        type: 'Bug',
        priority: 'High',
        reporterId: null,
        order: 0,
      })
    );
    expect(Notification.create).toHaveBeenCalledTimes(assigneeId === id ? 1 : 0);
    expect(res.status).toHaveBeenCalledWith(201);
  }
);

it('avoids logging unchanged status and assignee updates', async () => {
  const task = { _id: id, status: 'Todo', assigneeId: null, save: jest.fn() };
  const find = jest.spyOn(Task, 'findOne');
  find.mockResolvedValueOnce(task).mockReturnValue(query(task));
  const res = response();
  await updateTask({ params: { id }, body: { assigneeId: 'invalid' } }, res);
  expect(task.assigneeId).toBeNull();
  find.mockResolvedValueOnce(task).mockReturnValue(query(task));
  await updateTaskStatus({ params: { id }, body: { status: 'Todo' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
});

it('deletes a task addressed by ObjectId', async () => {
  const task = { _id: id, save: jest.fn() };
  jest.spyOn(Task, 'findOne').mockResolvedValue(task);
  const res = response();
  await deleteTask({ params: { id } }, res);
  expect(task.isDeleted).toBe(true);
  expect(res.status).toHaveBeenCalledWith(200);
});
