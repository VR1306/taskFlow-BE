import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import {
  getAllUsers,
  createUserApiCall,
  getUserByIdApiCall,
  updateUserApiCall,
  deleteUserApiCall,
  exportUsersApiCall,
} from './users.controller.js';
import GetAllUsers from '../../models/users/users.model.js';

describe('Users Controller', () => {
  let mockReq;
  let mockRes;
  let mockSendMail;

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

    mockSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  describe('getAllUsers', () => {
    it('returns paginated list of non-deleted users with default page and limit', async () => {
      const mockUsersList = [
        {
          _id: '1',
          userId: 'TF0001',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          role: 'User',
          isActive: true,
        },
        {
          _id: '2',
          userId: 'TF0002',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          role: 'Admin',
          isActive: true,
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(25);

      mockReq.query = {};

      await getAllUsers(mockReq, mockRes);

      expect(GetAllUsers.find).toHaveBeenCalledWith({ isDeleted: { $ne: true } });
      expect(findMock.skip).toHaveBeenCalledWith(0);
      expect(findMock.limit).toHaveBeenCalledWith(10);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: {
            totalItems: 25,
            totalPages: 3,
            currentPage: 1,
            limit: 10,
            hasNextPage: true,
            hasPrevPage: false,
          },
          data: mockUsersList,
        })
      );
    });

    it('handles custom pagination parameters and edge bounds', async () => {
      const mockUsersList = [
        {
          _id: '3',
          userId: 'TF0003',
          firstName: 'Charlie',
          lastName: 'Brown',
          email: 'charlie@example.com',
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(10);

      mockReq.query = { page: '2', limit: '5' };

      await getAllUsers(mockReq, mockRes);

      expect(findMock.skip).toHaveBeenCalledWith(5);
      expect(findMock.limit).toHaveBeenCalledWith(5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            currentPage: 2,
            limit: 5,
            totalPages: 2,
            hasNextPage: false,
            hasPrevPage: true,
          }),
        })
      );
    });

    it('filters users by search query across firstName, lastName, email, and userId', async () => {
      const mockUsersList = [
        {
          _id: '4',
          userId: 'TF0004',
          firstName: 'Sarah',
          lastName: 'Connor',
          email: 'sarah@resistance.org',
          isActive: true,
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(1);

      mockReq.query = { search: 'Sarah' };

      await getAllUsers(mockReq, mockRes);

      expect(GetAllUsers.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: { $ne: true },
          $or: expect.arrayContaining([
            { firstName: expect.any(RegExp) },
            { lastName: expect.any(RegExp) },
            { email: expect.any(RegExp) },
            { userId: expect.any(RegExp) },
          ]),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockUsersList,
          pagination: expect.objectContaining({
            totalItems: 1,
            totalPages: 1,
          }),
        })
      );
    });

    it('filters users by role and status query parameters', async () => {
      const mockUsersList = [
        {
          _id: '5',
          userId: 'TF0005',
          firstName: 'Emma',
          lastName: 'Watson',
          email: 'emma@example.com',
          role: 'Admin',
          isActive: true,
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(1);

      mockReq.query = { role: 'Admin', status: 'Active' };

      await getAllUsers(mockReq, mockRes);

      expect(GetAllUsers.find).toHaveBeenCalledWith({
        isDeleted: { $ne: true },
        role: 'Admin',
        isActive: { $ne: false },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('filters users by Inactive status', async () => {
      const mockUsersList = [
        {
          _id: '6',
          userId: 'TF0006',
          firstName: 'Inactive',
          lastName: 'User',
          email: 'inactive@example.com',
          role: 'User',
          isActive: false,
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(1);

      mockReq.query = { status: 'Inactive' };

      await getAllUsers(mockReq, mockRes);

      expect(GetAllUsers.find).toHaveBeenCalledWith({
        isDeleted: { $ne: true },
        isActive: false,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('builds user filter accurately with buildUserFilter helper', () => {
      const { buildUserFilter } = jest.requireActual('./users.controller.js');
      const filter1 = buildUserFilter({ search: 'John Doe', role: 'Admin', status: 'Active' });
      expect(filter1.isDeleted).toEqual({ $ne: true });
      expect(filter1.role).toBe('Admin');
      expect(filter1.isActive).toEqual({ $ne: false });
      expect(filter1.$or).toHaveLength(4);

      const filter2 = buildUserFilter({ search: '', role: 'all', status: 'false' });
      expect(filter2.isDeleted).toEqual({ $ne: true });
      expect(filter2.role).toBeUndefined();
      expect(filter2.isActive).toBe(false);

      const filter3 = buildUserFilter({ search: '', role: '', status: 'all' });
      expect(filter3.role).toBeUndefined();
      expect(filter3.isActive).toBeUndefined();
    });
  });

  describe('createUserApiCall', () => {
    it('returns 400 when email already exists and is not deleted', async () => {
      mockReq.body = {
        firstName: 'Existing',
        lastName: 'User',
        email: 'exists@example.com',
        role: 'User',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: 'user-1', email: 'exists@example.com', isDeleted: false }),
      });

      await createUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists. Please use a different email.',
      });
    });

    it('creates new user and sends welcome email successfully', async () => {
      mockReq.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const mockCreatedUser = {
        _id: 'new-id-123',
        userId: 'TF0005',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
        createdAt: new Date(),
      };

      jest.spyOn(GetAllUsers, 'create').mockResolvedValue(mockCreatedUser);

      await createUserApiCall(mockReq, mockRes);

      expect(GetAllUsers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@example.com',
          role: 'User',
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User created successfully and credential email sent!',
          user: expect.objectContaining({
            id: 'new-id-123',
            userId: 'TF0005',
            email: 'newuser@example.com',
          }),
        })
      );
    });

    it('creates user successfully even when welcome email fails', async () => {
      mockReq.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const mockCreatedUser = {
        _id: 'new-id-123',
        userId: 'TF0006',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
        createdAt: new Date(),
      };

      jest.spyOn(GetAllUsers, 'create').mockResolvedValue(mockCreatedUser);
      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUserByIdApiCall', () => {
    it('returns user details when user is found and not deleted', async () => {
      mockReq.params = { id: '6aa5108c8c37e86149679ff7' };

      const mockUser = {
        _id: '6aa5108c8c37e86149679ff7',
        userId: 'TF0001',
        firstName: 'Vijayaraghavan',
        lastName: 'K',
        email: 'vijayaraghavan130699@gmail.com',
        role: 'SuperAdmin',
      };

      const findOneMock = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue(findOneMock);

      await getUserByIdApiCall(mockReq, mockRes);

      expect(GetAllUsers.findOne).toHaveBeenCalledWith({
        _id: '6aa5108c8c37e86149679ff7',
        isDeleted: { $ne: true },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '6aa5108c8c37e86149679ff7',
          userId: 'TF0001',
        }),
      });
    });

    it('returns 404 when user is not found or is soft-deleted', async () => {
      mockReq.params = { id: 'unknown-id' };

      const findOneMock = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue(findOneMock);

      await getUserByIdApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found.',
      });
    });
  });

  describe('updateUserApiCall', () => {
    it('updates user fields successfully', async () => {
      mockReq.params = { id: 'user-123' };
      mockReq.body = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        role: 'Admin',
      };

      const mockUserDoc = {
        _id: 'user-123',
        userId: 'TF0002',
        firstName: 'OldFirst',
        lastName: 'OldLast',
        email: 'user@example.com',
        role: 'User',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUserDoc);

      await updateUserApiCall(mockReq, mockRes);

      expect(mockUserDoc.firstName).toBe('UpdatedFirst');
      expect(mockUserDoc.lastName).toBe('UpdatedLast');
      expect(mockUserDoc.role).toBe('Admin');
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User updated successfully.',
        })
      );
    });

    it('prevents demoting primary SuperAdmin', async () => {
      mockReq.params = { id: 'superadmin-123' };
      mockReq.body = {
        role: 'User',
      };

      const mockSuperAdminDoc = {
        _id: 'superadmin-123',
        email: 'vijayaraghavan130699@gmail.com',
        role: 'SuperAdmin',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockSuperAdminDoc);

      await updateUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot demote the primary SuperAdmin account.',
      });
    });

    it('returns 400 when updating email to an already used email', async () => {
      mockReq.params = { id: 'user-123' };
      mockReq.body = { email: 'conflict@example.com' };

      const mockUserDoc = {
        _id: 'user-123',
        email: 'old@example.com',
        role: 'User',
      };

      jest
        .spyOn(GetAllUsers, 'findOne')
        .mockResolvedValueOnce(mockUserDoc) // find target user
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({ _id: 'other-user', email: 'conflict@example.com' }),
        }); // email conflict check

      await updateUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is already in use by another member.',
      });
    });
  });

  describe('deleteUserApiCall (Soft Delete)', () => {
    it('soft deletes a regular user', async () => {
      mockReq.params = { id: 'user-to-delete' };

      const mockUserDoc = {
        _id: 'user-to-delete',
        email: 'regular@example.com',
        role: 'User',
        isDeleted: false,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockUserDoc);

      await deleteUserApiCall(mockReq, mockRes);

      expect(mockUserDoc.isDeleted).toBe(true);
      expect(mockUserDoc.deletedAt).toBeInstanceOf(Date);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully.',
      });
    });

    it('prevents soft-deleting SuperAdmin', async () => {
      mockReq.params = { id: 'superadmin-id' };

      const mockSuperAdminDoc = {
        _id: 'superadmin-id',
        email: 'vijayaraghavan130699@gmail.com',
        role: 'SuperAdmin',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(mockSuperAdminDoc);

      await deleteUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Deletion prohibited: SuperAdmin account cannot be deleted.',
      });
    });

    it('returns 404 if user to delete is not found', async () => {
      mockReq.params = { id: 'unknown-id' };

      jest.spyOn(GetAllUsers, 'findOne').mockResolvedValue(null);

      await deleteUserApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found.',
      });
    });
  });

  describe('exportUsersApiCall', () => {
    it('exports users in JSON format by default', async () => {
      const mockUsers = [
        {
          userId: 'TF0001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'Admin',
          isActive: true,
          createdAt: new Date('2026-01-01'),
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);

      mockReq.query = { format: 'json' };

      await exportUsersApiCall(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          total: 1,
          data: expect.arrayContaining([
            expect.objectContaining({ email: 'john@example.com', role: 'Admin' }),
          ]),
        })
      );
    });

    it('exports users in CSV format when requested', async () => {
      const mockUsers = [
        {
          userId: 'TF0001',
          firstName: 'John, Jr.',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'Admin',
          isActive: true,
          createdAt: new Date('2026-01-01'),
        },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);

      mockReq.query = { format: 'csv' };
      mockRes.setHeader = jest.fn();
      mockRes.send = jest.fn();

      await exportUsersApiCall(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('"John, Jr."'));
    });
  });
});
