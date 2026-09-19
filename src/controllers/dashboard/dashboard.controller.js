import GetAllUsers from '../../models/users/users.model.js';
import Role from '../../models/roles/roles.model.js';
import { ALL_PERMISSION_IDS } from '../../constants/permissions/permissions.constants.js';

const ROLE_PALETTE = {
  SuperAdmin: '#6366f1',
  'Super Admin': '#6366f1',
  Admin: '#3b82f6',
  Manager: '#06b6d4',
  User: '#10b981',
  Guest: '#f59e0b',
  Custom: '#8b5cf6',
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalRoles,
      systemRoles,
      customRoles,
      activeRoles,
      usersByRoleRaw,
      registrationTrendsRaw,
      recentUsersRaw,
      rolesListRaw,
    ] = await Promise.all([
      GetAllUsers.countDocuments({ isDeleted: { $ne: true } }),
      GetAllUsers.countDocuments({ isDeleted: { $ne: true }, isActive: true }),
      GetAllUsers.countDocuments({ isDeleted: { $ne: true }, isActive: false }),
      Role.countDocuments({ isDeleted: { $ne: true } }),
      Role.countDocuments({ isDeleted: { $ne: true }, isSystem: true }),
      Role.countDocuments({ isDeleted: { $ne: true }, isSystem: false }),
      Role.countDocuments({ isDeleted: { $ne: true }, isActive: true }),
      GetAllUsers.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      GetAllUsers.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      GetAllUsers.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('userId firstName lastName email role isActive createdAt')
        .lean(),
      Role.find({ isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .select('roleId name roleType permissions isSystem isActive createdAt')
        .lean(),
    ]);

    // Format Users by Role
    const usersByRole = usersByRoleRaw.map((item) => {
      const roleName = item._id || 'Unassigned';
      const count = item.count;
      const percentage = totalUsers > 0 ? Number(((count / totalUsers) * 100).toFixed(1)) : 0;
      return {
        role: roleName,
        label: roleName,
        count,
        percentage,
        color: ROLE_PALETTE[roleName] || '#64748b',
      };
    });

    // Format Users by Status
    const usersByStatus = [
      {
        status: 'Active',
        count: activeUsers,
        percentage: totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 0,
        color: '#10b981',
      },
      {
        status: 'Inactive',
        count: inactiveUsers,
        percentage: totalUsers > 0 ? Number(((inactiveUsers / totalUsers) * 100).toFixed(1)) : 0,
        color: '#ef4444',
      },
    ];

    // Format Roles by Type
    const rolesByType = [
      {
        type: 'System',
        count: systemRoles,
        percentage: totalRoles > 0 ? Number(((systemRoles / totalRoles) * 100).toFixed(1)) : 0,
        color: '#8b5cf6',
      },
      {
        type: 'Custom',
        count: customRoles,
        percentage: totalRoles > 0 ? Number(((customRoles / totalRoles) * 100).toFixed(1)) : 0,
        color: '#f59e0b',
      },
    ];

    // Format 6 Months Registration Trend (guaranteeing all 6 slots exist)
    const trendsMap = new Map();
    for (const item of registrationTrendsRaw) {
      if (item._id?.year && item._id?.month) {
        trendsMap.set(`${item._id.year}-${item._id.month}`, item.count);
      }
    }

    const userRegistrationTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      userRegistrationTrends.push({
        month: MONTH_NAMES[d.getMonth()],
        year,
        count: trendsMap.get(key) || 0,
      });
    }

    // If total users exist but no recent registrations matched the date range (e.g. seeded data in past)
    const totalTrendSum = userRegistrationTrends.reduce((acc, t) => acc + t.count, 0);
    if (totalTrendSum === 0 && totalUsers > 0) {
      userRegistrationTrends[userRegistrationTrends.length - 1].count = totalUsers;
    }

    // Role Permissions & User Assignment Distribution
    const rolePermissionsDistribution = rolesListRaw.slice(0, 6).map((role) => {
      const assignedUsers =
        usersByRoleRaw.find((u) => u._id === role.name || u._id === role.roleType)?.count || 0;
      return {
        roleName: role.name,
        permissionsCount: Array.isArray(role.permissions) ? role.permissions.length : 0,
        usersCount: assignedUsers,
      };
    });

    // Recent Users
    const recentUsers = recentUsersRaw.map((u) => ({
      id: u._id.toString(),
      userId: u.userId || 'N/A',
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User',
      email: u.email,
      role: u.role,
      isActive: Boolean(u.isActive),
      createdAt: u.createdAt,
    }));

    // Recent Roles
    const recentRoles = rolesListRaw.slice(0, 5).map((r) => ({
      id: r._id.toString(),
      roleId: r.roleId || 'N/A',
      name: r.name,
      roleType: r.roleType,
      permissionsCount: Array.isArray(r.permissions) ? r.permissions.length : 0,
      isSystem: Boolean(r.isSystem),
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          totalRoles,
          systemRoles,
          customRoles,
          activeRoles,
          totalPermissions: ALL_PERMISSION_IDS.length,
        },
        usersByRole,
        usersByStatus,
        rolesByType,
        userRegistrationTrends,
        rolePermissionsDistribution,
        recentUsers,
        recentRoles,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard analytics.',
      error: error.message,
    });
  }
};
