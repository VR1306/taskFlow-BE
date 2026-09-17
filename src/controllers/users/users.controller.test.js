import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import { getAllUsers, createUserApiCall } from './users.controller.js';
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
    it('returns paginated list of users with default page and limit', async () => {
      const mockUsersList = [
        {
          _id: '1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          role: 'User',
        },
        { _id: '2', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', role: 'Admin' },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsersList),
      };

      jest.spyOn(GetAllUsers, 'find').mockReturnValue(findMock);
      jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(25);

      mockReq.query = {};

      await getAllUsers(mockReq, mockRes);

      expect(GetAllUsers.find).toHaveBeenCalled();
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
        { _id: '3', firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com' },
      ];

      const findMock = {
        select: jest.fn().mockReturnThis(),
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
  });

  describe('createUserApiCall', () => {
    it('returns 400 when email already exists', async () => {
      mockReq.body = {
        firstName: 'Existing',
        lastName: 'User',
        email: 'exists@example.com',
        role: 'User',
      };

      jest.spyOn(GetAllUsers, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'user-1', email: 'exists@example.com' }),
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
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
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
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'User',
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
});
