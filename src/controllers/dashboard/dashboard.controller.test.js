import { jest } from '@jest/globals';
import { getDashboardStats } from './dashboard.controller.js';
import GetAllUsers from '../../models/users/users.model.js';
import Role from '../../models/roles/roles.model.js';
import Project from '../../models/projects/projects.model.js';
import Task from '../../models/tasks/tasks.model.js';

describe('Dashboard Controller Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      user: { id: 'user123', email: 'admin@taskflow.com', role: 'Taskflow Admin' },
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

    jest.spyOn(Project, 'countDocuments').mockResolvedValue(3);
    jest.spyOn(Task, 'countDocuments').mockResolvedValue(12);
    jest.spyOn(Task, 'aggregate').mockResolvedValue([
      { _id: 'Todo', count: 5 },
      { _id: 'In Progress', count: 4 },
      { _id: 'In Review', count: 2 },
      { _id: 'Done', count: 1 },
    ]);

    jest
      .spyOn(GetAllUsers, 'aggregate')
      .mockResolvedValueOnce([
        { _id: 'Taskflow Admin', count: 2 },
        { _id: 'Project Manager', count: 3 },
        { _id: 'Developer', count: 5 },
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
        role: 'Taskflow Admin',
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
        name: 'Taskflow Admin',
        roleType: 'Taskflow Admin',
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
    expect(jsonCall.data.summary.totalProjects).toBe(3);
    expect(jsonCall.data.summary.totalTasks).toBe(12);
    expect(jsonCall.data.usersByRole).toHaveLength(3);
    expect(jsonCall.data.usersByStatus).toHaveLength(2);
    expect(jsonCall.data.rolesByType).toHaveLength(2);
    expect(jsonCall.data.tasksByStatus).toHaveLength(4);
    expect(jsonCall.data.tasksByStatus.find((t) => t.status === 'Todo').count).toBe(5);
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
    jest.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Task, 'aggregate').mockResolvedValue([]);
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
  it('handles an empty workspace and legacy records with missing optional fields', async () => {
    jest.spyOn(GetAllUsers, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Role, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Project, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Task, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Task, 'aggregate').mockResolvedValue([]);
    jest
      .spyOn(GetAllUsers, 'aggregate')
      .mockResolvedValueOnce([
        { _id: null, count: 0 },
        { _id: 'Developer', count: 0 },
      ])
      .mockResolvedValueOnce([{ _id: null }, { _id: { year: 2026 } }]);
    jest.spyOn(GetAllUsers, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 'user-1' }]),
    });
    jest.spyOn(Role, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: 'role-1', name: 'Custom', roleType: 'Developer' },
        { _id: 'role-2', name: 'Other' },
      ]),
    });
    await getDashboardStats(req, res);
    const data = res.json.mock.calls[0][0].data;
    expect(data.usersByRole[0]).toMatchObject({
      role: 'Unassigned',
      percentage: 0,
      color: '#64748b',
    });
    expect(data.recentUsers[0]).toMatchObject({ userId: 'N/A', name: 'User' });
    expect(data.recentRoles[0]).toMatchObject({ roleId: 'N/A', permissionsCount: 0 });
    expect(data.rolePermissionsDistribution[1].usersCount).toBe(0);
    expect(data.usersByStatus.every((item) => item.percentage === 0)).toBe(true);
    expect(data.rolesByType.every((item) => item.percentage === 0)).toBe(true);
  });
});
