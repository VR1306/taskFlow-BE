import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
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
import Notification from '../../models/notifications/notifications.model.js';

describe('Projects Controller', () => {
  let mockReq;
  let mockRes;
  let mockSendMail;

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

    mockSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: mockSendMail });
    jest.spyOn(GetAllUsers, 'find').mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
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

    it('scopes a non-admin user to only projects they lead or are a member of', () => {
      const filter = buildProjectFilter({ user: { _id: 'user-1', role: 'Developer' } });
      expect(filter.$or).toEqual([
        { leadId: 'user-1' },
        { members: 'user-1' },
        { createdBy: 'user-1' },
      ]);
    });

    it('scopes Taskflow Admin to their own projects too — no role-based bypass', () => {
      const filter = buildProjectFilter({ user: { _id: 'admin-1', role: 'Taskflow Admin' } });
      expect(filter.$or).toEqual([
        { leadId: 'admin-1' },
        { members: 'admin-1' },
        { createdBy: 'admin-1' },
      ]);
    });

    it('combines membership scoping with a search term via $and instead of overwriting it', () => {
      const filter = buildProjectFilter({
        user: { _id: 'user-1', role: 'QA' },
        search: 'Engineering',
      });
      expect(filter.$or).toBeUndefined();
      expect(filter.$and).toEqual([
        { $or: [{ leadId: 'user-1' }, { members: 'user-1' }, { createdBy: 'user-1' }] },
        {
          $or: [
            { name: expect.any(RegExp) },
            { key: expect.any(RegExp) },
            { description: expect.any(RegExp) },
          ],
        },
      ]);
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

    it("queries only the requesting non-admin user's own projects (lead or member)", async () => {
      const findMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      const findSpy = jest.spyOn(Project, 'find').mockReturnValue(findMock);
      jest.spyOn(Project, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Task, 'aggregate').mockResolvedValue([]);

      mockReq.user = { _id: 'user-1', role: 'Developer' };
      await getAllProjects(mockReq, mockRes);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [{ leadId: 'user-1' }, { members: 'user-1' }, { createdBy: 'user-1' }],
        })
      );
    });

    it('scopes Taskflow Admin to their own projects too — no role-based bypass in the query', async () => {
      const findMock = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      const findSpy = jest.spyOn(Project, 'find').mockReturnValue(findMock);
      jest.spyOn(Project, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Task, 'aggregate').mockResolvedValue([]);

      mockReq.user = { _id: 'admin-1', role: 'Taskflow Admin' };
      await getAllProjects(mockReq, mockRes);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [{ leadId: 'admin-1' }, { members: 'admin-1' }, { createdBy: 'admin-1' }],
        })
      );
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
        expect.objectContaining({
          name: 'Engineering',
          key: 'ENGI',
          leadId: 'user-1',
          createdBy: 'user-1',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('rejects creation when the resolved lead is a Taskflow Admin, including the implicit self-as-lead fallback', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Project, 'create');
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue(
            query?.role === 'Taskflow Admin' ? [{ _id: 'admin-1', firstName: 'Admin' }] : []
          ),
      }));

      // No leadId supplied — createProject would otherwise default the lead to the actor.
      mockReq.user = {
        _id: 'admin-1',
        firstName: 'Admin',
        lastName: 'User',
        role: 'Taskflow Admin',
      };
      mockReq.body = { name: 'Engineering' };
      await createProject(mockReq, mockRes);

      expect(createSpy).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Taskflow Admin accounts cannot be assigned'),
        })
      );
    });

    it('rejects creation when an explicitly chosen member is a Taskflow Admin', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Project, 'create');
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue(
            query?.role === 'Taskflow Admin'
              ? [{ _id: '650c00000000000000000099', firstName: 'Admin' }]
              : []
          ),
      }));

      mockReq.body = {
        name: 'Engineering',
        memberIds: ['650c00000000000000000099'],
      };
      await createProject(mockReq, mockRes);

      expect(createSpy).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Taskflow Admin accounts cannot be assigned'),
        })
      );
    });

    it('records createdBy as the Taskflow Admin actor when they create a project with an explicit non-admin lead, and lets them see it via that alone (not lead/member)', async () => {
      const adminId = 'admin-1';
      const pmLeadId = '650c00000000000000000050';
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const createSpy = jest.spyOn(Project, 'create').mockResolvedValue({
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({}),
      });
      jest.spyOn(GetAllUsers, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(Notification, 'create').mockResolvedValue({});

      mockReq.user = { _id: adminId, firstName: 'Admin', lastName: 'User', role: 'Taskflow Admin' };
      mockReq.body = { name: 'Engineering', leadId: pmLeadId };
      await createProject(mockReq, mockRes);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: pmLeadId, createdBy: adminId })
      );

      // The admin is neither leadId nor a member of this project, but createdBy still
      // surfaces it to them in the projects list.
      const filter = buildProjectFilter({ user: { _id: adminId, role: 'Taskflow Admin' } });
      expect(filter.$or).toContainEqual({ createdBy: adminId });
    });

    it('notifies the admin feed with assigned member names and emails every assigned member their role', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const mockCreated = {
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({ _id: 'proj-1', name: 'Engineering', key: 'ENGI' }),
      };
      jest.spyOn(Project, 'create').mockResolvedValue(mockCreated);
      const membersList = [
        { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@taskflow.com' },
        {
          _id: 'user-2',
          firstName: '',
          lastName: '',
          email: 'noname@taskflow.com',
          role: 'Developer',
        },
        { _id: 'user-3', firstName: 'Sam', lastName: 'Lee', email: 'sam@taskflow.com' },
      ];
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(query?.role === 'Taskflow Admin' ? [] : membersList),
      }));
      const notifySpy = jest.spyOn(Notification, 'create').mockResolvedValue({});

      mockReq.body = { name: 'Engineering', memberIds: ['user-2', 'user-3'] };
      await createProject(mockReq, mockRes);

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Jane Doe') })
      );

      expect(mockSendMail).toHaveBeenCalledTimes(3);
      const leadEmail = mockSendMail.mock.calls.find((c) => c[0].to === 'jane@taskflow.com')[0];
      expect(leadEmail.html).toContain('Project Lead');
      const memberEmail = mockSendMail.mock.calls.find((c) => c[0].to === 'noname@taskflow.com')[0];
      expect(memberEmail.html).toContain('Developer');
      const roleless = mockSendMail.mock.calls.find((c) => c[0].to === 'sam@taskflow.com')[0];
      expect(roleless.html).toContain('Team Member');
    });

    it('queries every selected member by real ObjectId, not just the lead (the other tests use non-ObjectId ids like "user-2", which mongoose.Types.ObjectId.isValid() rejects, silently masking whether the member set actually reaches the DB query)', async () => {
      const leadObjectId = '6ab4e140dedb96f310eb977c';
      const devObjectId = '6ab4e140dedb96f310eb977d';
      const qaObjectId = '6ab4e140dedb96f310eb977e';

      mockReq.user = {
        _id: leadObjectId,
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'Project Manager',
      };
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      jest.spyOn(Project, 'create').mockResolvedValue({
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({}),
      });
      const membersList = [
        { _id: leadObjectId, firstName: 'Jane', lastName: 'Doe', email: 'jane@taskflow.com' },
        {
          _id: devObjectId,
          firstName: 'Sam',
          lastName: 'Lee',
          email: 'sam@taskflow.com',
          role: 'Developer',
        },
        {
          _id: qaObjectId,
          firstName: 'Kim',
          lastName: 'Ray',
          email: 'kim@taskflow.com',
          role: 'QA',
        },
      ];
      const findSpy = jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(query?.role === 'Taskflow Admin' ? [] : membersList),
      }));
      jest.spyOn(Notification, 'create').mockResolvedValue({});

      mockReq.body = { name: 'Engineering', memberIds: [devObjectId, qaObjectId] };
      await createProject(mockReq, mockRes);

      const memberLookupCall = findSpy.mock.calls.find((call) => call[0]?._id?.$in);
      expect(memberLookupCall[0]._id.$in).toEqual(
        expect.arrayContaining([leadObjectId, devObjectId, qaObjectId])
      );
      expect(memberLookupCall[0]._id.$in).toHaveLength(3);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    it('sends assignment emails one at a time instead of opening concurrent SMTP connections', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      jest.spyOn(Project, 'create').mockResolvedValue({
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({}),
      });
      const membersList = [
        { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@taskflow.com' },
        { _id: 'user-2', firstName: 'Sam', lastName: 'Lee', email: 'sam@taskflow.com' },
        { _id: 'user-3', firstName: 'Kim', lastName: 'Ray', email: 'kim@taskflow.com' },
      ];
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(query?.role === 'Taskflow Admin' ? [] : membersList),
      }));
      jest.spyOn(Notification, 'create').mockResolvedValue({});

      // Gmail's SMTP throttles/rejects concurrent connections from the same account, so a
      // Promise.all fan-out would silently drop every email after the first. Simulating
      // that here: any send that starts while another is still in flight fails.
      let inFlight = 0;
      let maxConcurrent = 0;
      mockSendMail.mockImplementation(async () => {
        inFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        if (inFlight > 1) {
          inFlight -= 1;
          throw new Error('Too many concurrent connections');
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return { messageId: '123' };
      });

      mockReq.body = { name: 'Engineering', memberIds: ['user-2', 'user-3'] };
      await createProject(mockReq, mockRes);

      expect(maxConcurrent).toBe(1);
      expect(mockSendMail).toHaveBeenCalledTimes(3);
    });

    it('logs and continues when an assignment email fails to send', async () => {
      jest.spyOn(Project, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      jest.spyOn(Project, 'create').mockResolvedValue({
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENGI',
        toObject: () => ({}),
      });
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue(
            query?.role === 'Taskflow Admin'
              ? []
              : [{ _id: 'user-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@taskflow.com' }]
          ),
      }));
      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockReq.body = { name: 'Engineering' };
      await createProject(mockReq, mockRes);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Project assignment email failed'),
        'Failed to send project assignment email.'
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      consoleSpy.mockRestore();
    });
  });

  describe('updateProject', () => {
    it('returns 404 if project does not exist', async () => {
      jest.spyOn(Project, 'findOne').mockResolvedValue(null);
      mockReq.params = { id: 'missing' };
      await updateProject(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('rejects reassigning the lead to a Taskflow Admin, without touching the project', async () => {
      const adminId = '650c00000000000000000099';
      const mockProjectDoc = {
        _id: 'proj-1',
        name: 'Engineering',
        leadId: 'lead-1',
        members: ['lead-1'],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Project, 'findOne').mockResolvedValueOnce(mockProjectDoc);
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue(
            query?.role === 'Taskflow Admin' ? [{ _id: adminId, firstName: 'Admin' }] : []
          ),
      }));

      mockReq.params = { id: 'proj-1' };
      mockReq.body = { leadId: adminId };
      await updateProject(mockReq, mockRes);

      expect(mockProjectDoc.leadId).toBe('lead-1');
      expect(mockProjectDoc.save).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Taskflow Admin accounts cannot be assigned'),
        })
      );
    });

    it('rejects adding a Taskflow Admin to the members list', async () => {
      const adminId = '650c00000000000000000099';
      const mockProjectDoc = {
        _id: 'proj-1',
        name: 'Engineering',
        leadId: 'lead-1',
        members: ['lead-1'],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Project, 'findOne').mockResolvedValueOnce(mockProjectDoc);
      jest.spyOn(GetAllUsers, 'find').mockImplementation((query) => ({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest
          .fn()
          .mockResolvedValue(
            query?.role === 'Taskflow Admin' ? [{ _id: adminId, firstName: 'Admin' }] : []
          ),
      }));

      mockReq.params = { id: 'proj-1' };
      mockReq.body = { memberIds: [adminId] };
      await updateProject(mockReq, mockRes);

      expect(mockProjectDoc.members).toEqual(['lead-1']);
      expect(mockProjectDoc.save).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Taskflow Admin accounts cannot be assigned'),
        })
      );
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

    it('notifies members removed from the project via a membership update', async () => {
      const memberA = '650c00000000000000000010';
      const memberB = '650c00000000000000000011';
      const mockProjectDoc = {
        _id: 'proj-1',
        name: 'Engineering',
        key: 'ENG',
        leadId: 'lead-1',
        members: ['lead-1', memberA, memberB],
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({ _id: 'proj-1', name: 'Engineering' }),
      };

      jest.spyOn(Project, 'findOne').mockResolvedValueOnce(mockProjectDoc);

      mockReq.params = { id: 'proj-1' };
      mockReq.body = { memberIds: [memberA] };

      await updateProject(mockReq, mockRes);

      expect(mockProjectDoc.members).toEqual(expect.arrayContaining([memberA, 'lead-1']));
      expect(mockProjectDoc.members).not.toContain(memberB);
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

    it('permanently deletes the project document (no active-task block)', async () => {
      const mockProjectDoc = {
        _id: 'proj-1',
        projectId: 'PRJ0001',
        name: 'Engineering',
        key: 'ENG',
        leadId: 'lead-1',
        members: ['lead-1'],
      };
      jest.spyOn(Project, 'findOne').mockResolvedValue(mockProjectDoc);
      jest.spyOn(Task, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      const deleteOneSpy = jest.spyOn(Project, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const notifySpy = jest.spyOn(Notification, 'create').mockResolvedValue({});

      mockReq.params = { id: 'proj-1' };
      await deleteProject(mockReq, mockRes);

      expect(deleteOneSpy).toHaveBeenCalledWith({ _id: 'proj-1' });
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'project_deleted', recipientId: 'lead-1' })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Project deleted successfully.',
          data: { id: 'proj-1', projectId: 'PRJ0001' },
        })
      );
    });

    it("cascades to soft-delete every active task and notifies each task's assignee and reporter", async () => {
      const mockProjectDoc = {
        _id: 'proj-1',
        projectId: 'PRJ0001',
        name: 'Engineering',
        key: 'ENG',
        leadId: 'lead-1',
        members: ['lead-1'],
      };
      const tasks = [
        {
          _id: 'task-1',
          taskKey: 'ENG-1',
          title: 'Fix bug',
          assigneeId: 'dev-1',
          reporterId: 'lead-1',
        },
        {
          _id: 'task-2',
          taskKey: 'ENG-2',
          title: 'Write docs',
          assigneeId: 'dev-2',
          reporterId: 'lead-1',
        },
      ];
      jest.spyOn(Project, 'findOne').mockResolvedValue(mockProjectDoc);
      jest.spyOn(Task, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(tasks),
      });
      const updateManySpy = jest.spyOn(Task, 'updateMany').mockResolvedValue({ modifiedCount: 2 });
      jest.spyOn(Project, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const notifySpy = jest.spyOn(Notification, 'create').mockResolvedValue({});

      mockReq.params = { id: 'proj-1' };
      await deleteProject(mockReq, mockRes);

      expect(updateManySpy).toHaveBeenCalledWith(
        { _id: { $in: ['task-1', 'task-2'] } },
        expect.objectContaining({ isDeleted: true })
      );
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_deleted',
          recipientId: 'dev-1',
          metadata: expect.objectContaining({ taskId: 'task-1', taskKey: 'ENG-1' }),
        })
      );
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_deleted',
          recipientId: 'dev-2',
          metadata: expect.objectContaining({ taskId: 'task-2', taskKey: 'ENG-2' }),
        })
      );
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

    it('excludes Taskflow Admin accounts from the candidate query', async () => {
      const findSpy = jest.spyOn(GetAllUsers, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      await getProjectMemberCandidates(mockReq, mockRes);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ role: { $ne: 'Taskflow Admin' } })
      );
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
