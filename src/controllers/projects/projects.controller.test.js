import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  buildProjectFilter,
  generateProjectKey,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectMemberCandidates,
} from './projects.controller.js';
import Project from '../../models/projects/projects.model.js';
import Task from '../../models/tasks/tasks.model.js';
import GetAllUsers from '../../models/users/users.model.js';

describe('Projects Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      params: {},
      user: { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', role: 'Project Manager' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('buildProjectFilter', () => {
    it('returns default non-deleted filter when no query params provided', () => {
      expect(buildProjectFilter({})).toEqual({ isDeleted: { $ne: true } });
    });

    it('builds search regex filter for name, key, description', () => {
      const filter = buildProjectFilter({ search: 'Engineering' });
      expect(filter.$or).toHaveLength(3);
    });

    it('handles status filtering', () => {
      expect(buildProjectFilter({ status: 'archived' }).status).toBe('archived');
      expect(buildProjectFilter({ status: 'all' }).status).toBeUndefined();
    });
  });

  describe('generateProjectKey', () => {
    it('derives an acronym key from a multi-word name', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const key = await generateProjectKey('Customer Portal Revamp');
      expect(key).toBe('CPR');
    });

    it('derives a truncated key from a single-word name', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const key = await generateProjectKey('Engineering');
      expect(key).toBe('ENGI');
    });

    it('appends a numeric suffix on key collision', async () => {
      jest
        .spyOn(Project, 'findOne')
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ key: 'ENGI' }) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });
      const key = await generateProjectKey('Engineering');
      expect(key).toBe('ENGI2');
    });
  });

  describe('getAllProjects', () => {
    it('returns paginated projects with member and task counts', async () => {
      const mockProjects = [
        {
          _id: new mongoose.Types.ObjectId('650c00000000000000000001'),
          projectId: 'PRJ0001',
          key: 'ENG',
          name: 'Engineering',
          members: ['a', 'b'],
        },
      ];

      const findMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProjects),
      };

      jest.spyOn(Project, 'find').mockReturnValue(findMock);
      jest.spyOn(Project, 'countDocuments').mockResolvedValue(1);
      jest
        .spyOn(Task, 'aggregate')
        .mockResolvedValue([
          { _id: new mongoose.Types.ObjectId('650c00000000000000000001'), count: 4 },
        ]);

      await getAllProjects(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data[0].memberCount).toBe(2);
      expect(payload.data[0].taskCount).toBe(4);
    });
  });

  describe('getProjectById', () => {
    it('returns 404 when project is not found', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      mockReq.params = { id: 'unknown' };
      await getProjectById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns project details with counts when found', async () => {
      const mockProject = {
        _id: new mongoose.Types.ObjectId('650c00000000000000000001'),
        projectId: 'PRJ0001',
        key: 'ENG',
        name: 'Engineering',
        members: ['a'],
      };

      jest.spyOn(Project, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockProject),
      });
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(2);

      mockReq.params = { id: 'PRJ0001' };
      await getProjectById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data.taskCount).toBe(2);
      expect(payload.data.memberCount).toBe(1);
    });
  });

  describe('createProject', () => {
    it('returns 400 when name is missing', async () => {
      mockReq.body = {};
      await createProject(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when a project with the same name exists', async () => {
      jest
        .spyOn(Project, 'findOne')
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: 'existing' }) });

      mockReq.body = { name: 'Engineering' };
      await createProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'A project with this name already exists.' })
      );
    });

    it('creates a project with a generated key and default lead/membership', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const mockCreated = {
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({ _id: 'proj-1', name: 'Engineering', key: 'ENGI' }),
      };
      const createSpy = jest.spyOn(Project, 'create').mockResolvedValue(mockCreated);

      mockReq.body = { name: 'Engineering' };
      await createProject(mockReq, mockRes);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Engineering', key: 'ENGI', leadId: 'user-1' })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateProject', () => {
    it('returns 404 if project does not exist', async () => {
      jest.spyOn(Project, 'findOne').mockResolvedValue(null);
      mockReq.params = { id: 'missing' };
      await updateProject(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('updates project fields and membership', async () => {
      const mockProjectDoc = {
        _id: 'proj-1',
        name: 'Engineering',
        leadId: 'lead-1',
        members: ['lead-1'],
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({ _id: 'proj-1', name: 'Engineering Team' }),
      };

      jest
        .spyOn(Project, 'findOne')
        .mockResolvedValueOnce(mockProjectDoc)
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });

      const memberA = '650c00000000000000000010';
      const memberB = '650c00000000000000000011';

      mockReq.params = { id: 'proj-1' };
      mockReq.body = { name: 'Engineering Team', memberIds: [memberA, memberB] };

      await updateProject(mockReq, mockRes);

      expect(mockProjectDoc.name).toBe('Engineering Team');
      expect(mockProjectDoc.members).toEqual(expect.arrayContaining([memberA, memberB, 'lead-1']));
      expect(mockProjectDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteProject', () => {
    it('returns 404 if project does not exist', async () => {
      jest.spyOn(Project, 'findOne').mockResolvedValue(null);
      mockReq.params = { id: 'missing' };
      await deleteProject(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('blocks deletion when active tasks exist', async () => {
      jest.spyOn(Project, 'findOne').mockResolvedValue({ _id: 'proj-1' });
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(3);

      mockReq.params = { id: 'proj-1' };
      await deleteProject(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Cannot delete project'),
        })
      );
    });

    it('soft deletes the project when it has no active tasks', async () => {
      const mockProjectDoc = {
        _id: 'proj-1',
        projectId: 'PRJ0001',
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Project, 'findOne').mockResolvedValue(mockProjectDoc);
      jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);

      mockReq.params = { id: 'proj-1' };
      await deleteProject(mockReq, mockRes);

      expect(mockProjectDoc.isDeleted).toBe(true);
      expect(mockProjectDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProjectMemberCandidates', () => {
    it('returns active users as candidates', async () => {
      const mockUsers = [{ _id: 'u1', firstName: 'A' }];
      jest.spyOn(GetAllUsers, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers),
      });

      await getProjectMemberCandidates(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data).toHaveLength(1);
    });
  });
  it('rejects duplicate explicit project keys', async () => {
    jest
      .spyOn(Project, 'findOne')
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ key: 'ENG' }) });
    mockReq.body = { name: 'Engineering', key: 'eng' };
    await createProject(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'A project with this key already exists.',
    });
  });

  it('filters invalid project members and retains the lead', async () => {
    jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const doc = {
      _id: 'project-1',
      name: 'Engineering',
      key: 'ENG',
      toObject: () => ({ name: 'Engineering' }),
    };
    const create = jest.spyOn(Project, 'create').mockResolvedValue(doc);
    mockReq.body = {
      name: 'Engineering',
      key: 'eng',
      leadId: '650c00000000000000000001',
      memberIds: ['650c00000000000000000002', 'invalid'],
    };
    await createProject(mockReq, mockRes);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ENG',
        members: ['650c00000000000000000002', '650c00000000000000000001'],
      })
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  it('rejects duplicate project names on update', async () => {
    jest
      .spyOn(Project, 'findOne')
      .mockResolvedValueOnce({ _id: 'project-1', name: 'Old' })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: 'Existing' }) });
    mockReq.params.id = 'PRJ0001';
    mockReq.body = { name: 'Existing' };
    await updateProject(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
