import { jest } from '@jest/globals';
import { getDashboardStats } from './dashboard.controller.js';
import GetAllUsers from '../../models/users/users.model.js';
import Role from '../../models/roles/roles.model.js';

describe('Dashboard Controller Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      user: { id: 'user123', email: 'admin@taskflow.com', role: 'SuperAdmin' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return aggregated dashboard statistics successfully', async () => {
    jest
      .spyOn(GetAllUsers, 'countDocuments')
      .mockResolvedValueOnce(10) // totalUsers
      .mockResolvedValueOnce(8) // activeUsers
      .mockResolvedValueOnce(2); // inactiveUsers

    jest
      .spyOn(Role, 'countDocuments')
      .mockResolvedValueOnce(4) // totalRoles
      .mockResolvedValueOnce(3) // systemRoles
      .mockResolvedValueOnce(1) // customRoles
      .mockResolvedValueOnce(4); // activeRoles

    jest
      .spyOn(GetAllUsers, 'aggregate')
      .mockResolvedValueOnce([
        { _id: 'SuperAdmin', count: 2 },
        { _id: 'Admin', count: 3 },
        { _id: 'User', count: 5 },
      ])
      .mockResolvedValueOnce([
        { _id: { year: 2026, month: 9 }, count: 5 },
        { _id: { year: 2026, month: 8 }, count: 3 },
      ]);

    const mockRecentUsers = [
      {
        _id: '66e123456789012345678901',
        userId: 'TF0001',
        firstName: 'Vijay',
        lastName: 'K',
        email: 'vijay@test.com',
        role: 'SuperAdmin',
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const mockFindUsers = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecentUsers),
    };
    jest.spyOn(GetAllUsers, 'find').mockReturnValue(mockFindUsers);

    const mockRolesList = [
      {
        _id: '66e123456789012345678902',
        roleId: 'RL0001',
        name: 'Super Admin',
        roleType: 'Super Admin',
        permissions: ['users.view', 'roles.view'],
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const mockFindRoles = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRolesList),
    };
    jest.spyOn(Role, 'find').mockReturnValue(mockFindRoles);

    await getDashboardStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.success).toBe(true);
    expect(jsonCall.data.summary.totalUsers).toBe(10);
    expect(jsonCall.data.summary.activeUsers).toBe(8);
    expect(jsonCall.data.summary.inactiveUsers).toBe(2);
    expect(jsonCall.data.summary.totalRoles).toBe(4);
    expect(jsonCall.data.usersByRole).toHaveLength(3);
    expect(jsonCall.data.usersByStatus).toHaveLength(2);
    expect(jsonCall.data.rolesByType).toHaveLength(2);
    expect(jsonCall.data.userRegistrationTrends).toHaveLength(6);
    expect(jsonCall.data.recentUsers).toHaveLength(1);
    expect(jsonCall.data.recentRoles).toHaveLength(1);
  });

  it('should fallback to totalUsers in latest trend month if no date-matched registrations exist', async () => {
    jest
      .spyOn(GetAllUsers, 'countDocuments')
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    jest.spyOn(Role, 'countDocuments').mockResolvedValue(2);
    jest.spyOn(GetAllUsers, 'aggregate').mockResolvedValue([]);

    const mockFindUsers = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(GetAllUsers, 'find').mockReturnValue(mockFindUsers);

    const mockFindRoles = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(Role, 'find').mockReturnValue(mockFindRoles);

    await getDashboardStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    const trends = jsonCall.data.userRegistrationTrends;
    expect(trends[trends.length - 1].count).toBe(5);
  });

  it('should return 500 when database error occurs', async () => {
    jest.spyOn(GetAllUsers, 'countDocuments').mockRejectedValue(new Error('DB Query Failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await getDashboardStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Failed to retrieve dashboard analytics.',
        error: 'DB Query Failed',
      })
    );
    expect(consoleSpy).toHaveBeenCalled();
  });
});
