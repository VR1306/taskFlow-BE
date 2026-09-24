import { jest } from '@jest/globals';
import Project from '../../models/projects/projects.model.js';
import Task from '../../models/tasks/tasks.model.js';
import GetAllUsers from '../../models/users/users.model.js';
import {
  generateProjectKey,
  findActiveProject,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from './projects.controller.js';

const id = '650c00000000000000000001';
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const query = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

beforeEach(() => {
  jest.spyOn(GetAllUsers, 'find').mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
});

afterEach(() => jest.restoreAllMocks());

it.each([undefined, '1234'])(
  'generates a usable key from an empty or nonalphabetic name: %s',
  async (name) => {
    jest.spyOn(Project, 'findOne').mockReturnValue(query(null));
    expect(await generateProjectKey(name)).toBe('PROJ');
  }
);

it.each([undefined, id])('builds an active project query for %s', (identifier) => {
  const chain = query(null);
  jest.spyOn(Project, 'findOne').mockReturnValue(chain);
  expect(findActiveProject(identifier)).toBe(chain);
  expect(Project.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ isDeleted: { $ne: true } })
  );
});

it('returns empty pagination and zero counts for legacy project records', async () => {
  jest.spyOn(Project, 'find').mockReturnValue(query([{ _id: id }]));
  jest.spyOn(Project, 'countDocuments').mockResolvedValue(0);
  jest.spyOn(Task, 'aggregate').mockResolvedValue([]);
  const res = response();
  await getAllProjects(
    { query: { search: ' test ', status: ' active ', page: '2', limit: '3' } },
    res
  );
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      pagination: expect.objectContaining({ totalPages: 1, currentPage: 2 }),
      data: [expect.objectContaining({ memberCount: 0, taskCount: 0 })],
    })
  );
});

it('returns zero members when a legacy project has no members array', async () => {
  jest.spyOn(Project, 'findOne').mockReturnValue(query({ _id: id }));
  jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
  const res = response();
  await getProjectById({ params: { id } }, res);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ memberCount: 0 }) })
  );
});

it('creates an archived project without an implicit lead when there is no request user', async () => {
  jest.spyOn(Project, 'findOne').mockReturnValue(query(null));
  const doc = { _id: id, name: 'Archive', key: 'ARCH', toObject: () => ({}) };
  jest.spyOn(Project, 'create').mockResolvedValue(doc);
  const res = response();
  await createProject(
    { body: { name: 'Archive', description: ' description ', status: 'archived', memberIds: [] } },
    res
  );
  expect(Project.create).toHaveBeenCalledWith(
    expect.objectContaining({
      leadId: null,
      status: 'archived',
      description: 'description',
      members: [],
    })
  );
  expect(res.status).toHaveBeenCalledWith(201);
});

it.each([
  { description: ' updated ', status: 'archived', leadId: id, memberIds: [id, 'invalid'] },
  { name: 'Same', status: 'invalid', leadId: 'invalid', memberIds: [] },
])('updates optional project fields: %j', async (body) => {
  const doc = { _id: id, name: 'Same', save: jest.fn(), toObject: () => ({}) };
  jest.spyOn(Project, 'findOne').mockResolvedValue(doc);
  const res = response();
  await updateProject({ params: { id }, body }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(doc.save).toHaveBeenCalledTimes(1);
  expect(doc.members).toEqual(body.leadId === id ? [id] : []);
});

it('deletes projects identified by ObjectId', async () => {
  const doc = { _id: id, projectId: 'PRJ0001', name: 'Test', key: 'TST' };
  jest.spyOn(Project, 'findOne').mockResolvedValue(doc);
  jest.spyOn(Task, 'find').mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
  const deleteOneSpy = jest.spyOn(Project, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
  const res = response();
  await deleteProject({ params: { id } }, res);
  expect(deleteOneSpy).toHaveBeenCalledWith({ _id: id });
  expect(res.status).toHaveBeenCalledWith(200);
});

it('preserves membership when updates omit memberIds', async () => {
  const doc = { _id: id, name: 'Same', members: [id], save: jest.fn(), toObject: () => ({}) };
  jest.spyOn(Project, 'findOne').mockResolvedValue(doc);
  const res = response();
  await updateProject({ params: { id }, body: {} }, res);
  expect(doc.members).toEqual([id]);
  expect(res.status).toHaveBeenCalledWith(200);
});
