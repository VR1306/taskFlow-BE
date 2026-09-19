import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  buildRoleFilter,
  getPermissionsCatalogue,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  exportRoles,
} from './roles.controller.js';
import Role, { getNextRoleId } from '../../models/roles/roles.model.js';
import GetAllUsers from '../../models/users/users.model.js';
import { SYSTEM_PERMISSIONS_CATALOGUE } from '../../constants/permissions/permissions.constants.js';

describe('Roles Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('buildRoleFilter', () => {
    it('returns default non-deleted filter when no query params provided', () => {
      const filter = buildRoleFilter({});
      expect(filter).toEqual({ isDeleted: { $ne: true } });
    });

    it('builds search regex filter for name, description, roleId, roleType', () => {
      const filter = buildRoleFilter({ search: 'Manager' });
      expect(filter.isDeleted).toEqual({ $ne: true });
      expect(filter.$or).toHaveLength(4);
      expect(filter.$or[0].name.test('Manager')).toBe(true);
      expect(filter.$or[1].description.test('Manager role description')).toBe(true);
    });

    it('handles roleType filtering correctly', () => {
      const filter = buildRoleFilter({ roleType: 'Admin' });
      expect(filter.roleType).toBe('Admin');

      const allFilter = buildRoleFilter({ roleType: 'all' });
      expect(allFilter.roleType).toBeUndefined();
    });

    it('handles status filtering for active and inactive', () => {
      const activeFilter = buildRoleFilter({ status: 'active' });
      expect(activeFilter.isActive).toEqual({ $ne: false });

      const inactiveFilter = buildRoleFilter({ status: 'inactive' });
      expect(inactiveFilter.isActive).toBe(false);

      const allFilter = buildRoleFilter({ status: 'all' });
      expect(allFilter.isActive).toBeUndefined();
    });
  });

  describe('getPermissionsCatalogue', () => {
    it('returns the grouped system permissions catalogue with 200 status', async () => {
      await getPermissionsCatalogue(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: SYSTEM_PERMISSIONS_CATALOGUE,
      });
    });
  });

  describe('getAllRoles', () => {
    it('returns paginated list of non-deleted roles with default pagination', async () => {
      const mockRolesList = [
        {
          _id: '1',
          roleId: 'RL0001',
          name: 'Super Admin',
          description: 'Full Access',
          roleType: 'Super Admin',
          permissions: ['users.view', 'users.create'],
          isSystem: true,
          isActive: true,
        },
        {
          _id: '2',
          roleId: 'RL0002',
          name: 'Project Admin',
          description: 'Project config',
          roleType: 'Admin',
          permissions: ['tasks.view'],
          isSystem: false,
          isActive: true,
        },
      ];

      const findMock = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRolesList),
      };

      jest.spyOn(Role, 'find').mockReturnValue(findMock);
      jest.spyOn(Role, 'countDocuments').mockResolvedValue(15);

      mockReq.query = { page: '1', limit: '10' };

      await getAllRoles(mockReq, mockRes);

      expect(Role.find).toHaveBeenCalledWith({ isDeleted: { $ne: true } });
      expect(findMock.skip).toHaveBeenCalledWith(0);
      expect(findMock.limit).toHaveBeenCalledWith(10);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: {
            totalItems: 15,
            totalPages: 2,
            currentPage: 1,
            limit: 10,
            hasNextPage: true,
            hasPrevPage: false,
          },
          data: mockRolesList,
        })
      );
    });

    it('handles query parameters for search and filtering with bounds checking', async () => {
      const findMock = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(Role, 'find').mockReturnValue(findMock);
      jest.spyOn(Role, 'countDocuments').mockResolvedValue(0);

      mockReq.query = {
        page: '-5',
        limit: '500',
        search: 'Editor',
        roleType: 'Custom',
        status: 'active',
      };

      await getAllRoles(mockReq, mockRes);

      expect(findMock.skip).toHaveBeenCalledWith(0);
      expect(findMock.limit).toHaveBeenCalledWith(100);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getRoleById', () => {
    it('returns role details when found by ObjectId', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const mockRole = {
        _id: validId,
        roleId: 'RL0001',
        name: 'Lead Developer',
        roleType: 'Custom',
        permissions: ['tasks.view'],
      };

      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRole),
      });

      mockReq.params = { id: validId };

      await getRoleById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRole,
      });
    });

    it('returns role details when found by roleId format', async () => {
      const mockRole = {
        _id: 'some-id',
        roleId: 'RL0003',
        name: 'QA Engineer',
      };

      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRole),
      });

      mockReq.params = { id: 'RL0003' };

      await getRoleById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRole,
      });
    });

    it('returns 404 if role is not found or deleted', async () => {
      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      mockReq.params = { id: 'RL9999' };

      await getRoleById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Role not found or has been deleted.',
        })
      );
    });
  });

  describe('createRole', () => {
    it('creates a new role successfully and returns 201', async () => {
      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const mockCreatedRole = {
        _id: 'new-id',
        roleId: 'RL0006',
        name: 'Support Lead',
        description: 'Customer Support Lead',
        roleType: 'User',
        permissions: ['users.view', 'tasks.view'],
        isSystem: false,
        isActive: true,
      };

      jest.spyOn(Role, 'create').mockResolvedValue(mockCreatedRole);

      mockReq.body = {
        name: 'Support Lead',
        description: 'Customer Support Lead',
        roleType: 'User',
        permissions: ['users.view', 'tasks.view'],
        isActive: true,
      };

      await createRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Role created successfully.',
        data: mockCreatedRole,
      });
    });

    it('returns 400 if a role with the same name already exists', async () => {
      jest.spyOn(Role, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: '1', name: 'Admin' }),
      });

      mockReq.body = {
        name: 'Admin',
        roleType: 'Admin',
      };

      await createRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'A role with this name already exists. Please choose a different name.',
        })
      );
    });
  });

  describe('updateRole', () => {
    it('updates an existing role successfully', async () => {
      const mockRoleDoc = {
        _id: 'role-123',
        roleId: 'RL0002',
        name: 'Old Name',
        description: 'Old Description',
        roleType: 'Custom',
        permissions: ['users.view'],
        isSystem: false,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      jest
        .spyOn(Role, 'findOne')
        .mockResolvedValueOnce(mockRoleDoc) // finding existing role
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) }); // duplicate check

      mockReq.params = { id: 'role-123' };
      mockReq.body = {
        name: 'Updated Name',
        description: 'Updated Description',
        roleType: 'Manager',
        permissions: ['users.view', 'users.edit'],
        isActive: false,
      };

      await updateRole(mockReq, mockRes);

      expect(mockRoleDoc.name).toBe('Updated Name');
      expect(mockRoleDoc.description).toBe('Updated Description');
      expect(mockRoleDoc.permissions).toEqual(['users.view', 'users.edit']);
      expect(mockRoleDoc.isActive).toBe(false);
      expect(mockRoleDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Role updated successfully.',
        })
      );
    });

    it('returns 404 if role to update does not exist', async () => {
      jest.spyOn(Role, 'findOne').mockResolvedValue(null);

      mockReq.params = { id: 'non-existent' };
      mockReq.body = { name: 'Something' };

      await updateRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 if updating name to a duplicate existing role name', async () => {
      const mockRoleDoc = {
        _id: 'role-123',
        name: 'Manager',
      };

      jest
        .spyOn(Role, 'findOne')
        .mockResolvedValueOnce(mockRoleDoc)
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ _id: 'other-role', name: 'Admin' }),
        });

      mockReq.params = { id: 'role-123' };
      mockReq.body = { name: 'Admin' };

      await updateRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'A role with this name already exists. Please choose a unique name.',
        })
      );
    });

    it('prevents deactivating Super Admin role', async () => {
      const mockSuperAdminDoc = {
        _id: 'super-admin-id',
        name: 'Super Admin',
        isSystem: true,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Role, 'findOne').mockResolvedValueOnce(mockSuperAdminDoc);

      mockReq.params = { id: 'super-admin-id' };
      mockReq.body = { isActive: false };

      await updateRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Super Admin role cannot be deactivated.',
        })
      );
    });
  });

  describe('deleteRole', () => {
    it('deletes a custom role successfully when no users are assigned', async () => {
      const mockRoleDoc = {
        _id: 'role-to-delete',
        roleId: 'RL0005',
        name: 'Temporary Role',
        isSystem: false,
        isDeleted: false,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Role, 'findOne').mockResolvedValue(mockRoleDoc);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(0);

      mockReq.params = { id: 'role-to-delete' };

      await deleteRole(mockReq, mockRes);

      expect(mockRoleDoc.isDeleted).toBe(true);
      expect(mockRoleDoc.deletedAt).toBeInstanceOf(Date);
      expect(mockRoleDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Role deleted successfully.',
        data: { roleId: 'RL0005', id: 'role-to-delete' },
      });
    });

    it('prevents deleting system protected roles', async () => {
      const mockSystemRole = {
        _id: 'sys-role',
        roleId: 'RL0001',
        name: 'Super Admin',
        isSystem: true,
      };

      jest.spyOn(Role, 'findOne').mockResolvedValue(mockSystemRole);

      mockReq.params = { id: 'sys-role' };

      await deleteRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Deletion prohibited: System protected roles cannot be deleted.',
        })
      );
    });

    it('prevents deleting roles that currently have active assigned users', async () => {
      const mockRoleDoc = {
        _id: 'role-in-use',
        roleId: 'RL0003',
        name: 'Developer',
        isSystem: false,
      };

      jest.spyOn(Role, 'findOne').mockResolvedValue(mockRoleDoc);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(4);

      mockReq.params = { id: 'role-in-use' };

      await deleteRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining(
            'Cannot delete role: 4 active user(s) are currently assigned'
          ),
        })
      );
    });

    it('returns 404 if role to delete is not found', async () => {
      jest.spyOn(Role, 'findOne').mockResolvedValue(null);

      mockReq.params = { id: 'non-existent' };

      await deleteRole(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getNextRoleId helper', () => {
    it('returns RL0001 when no previous roles exist', async () => {
      const mockModel = {
        findOne: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        collation: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      };

      const nextId = await getNextRoleId(mockModel);
      expect(nextId).toBe('RL0001');
    });

    it('increments sequential role ID correctly', async () => {
      const mockModel = {
        findOne: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        collation: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ roleId: 'RL0007' }),
      };

      const nextId = await getNextRoleId(mockModel);
      expect(nextId).toBe('RL0008');
    });
  });

  describe('exportRoles', () => {
    it('exports roles in JSON format by default', async () => {
      const mockRoles = [
        {
          roleId: 'ROLE0001',
          name: 'Super Admin',
          description: 'Full system root access',
          roleType: 'Super Admin',
          permissions: ['*'],
          isActive: true,
          isSystem: true,
          createdAt: new Date('2026-01-01'),
        },
      ];

      const findMock = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRoles),
      };

      jest.spyOn(Role, 'find').mockReturnValue(findMock);

      mockReq.query = { format: 'json' };

      await exportRoles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total: 1,
          data: expect.arrayContaining([
            expect.objectContaining({ roleId: 'ROLE0001', name: 'Super Admin' }),
          ]),
        })
      );
    });

    it('exports roles in CSV format when requested', async () => {
      const mockRoles = [
        {
          roleId: 'ROLE0001',
          name: 'Manager, Sales',
          description: 'Sales and marketing lead',
          roleType: 'Custom',
          permissions: ['users.view', 'roles.view'],
          isActive: true,
          isSystem: false,
          createdAt: new Date('2026-01-01'),
        },
      ];

      const findMock = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRoles),
      };

      jest.spyOn(Role, 'find').mockReturnValue(findMock);

      mockReq.query = { format: 'csv' };
      mockRes.setHeader = jest.fn();
      mockRes.send = jest.fn();

      await exportRoles(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('"Manager, Sales"'));
    });
  });
});
