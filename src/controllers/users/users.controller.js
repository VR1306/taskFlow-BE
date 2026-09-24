import {
  catchAsync,
  generateRandomHexToken,
  escapeRegex,
  serializeCsv,
} from '../../helpers/helpers.js';
import { sendWelcomeEmail } from '../../helpers/sendEmail.js';
import GetAllUsers from '../../models/users/users.model.js';
import { createNotification } from '../../helpers/notification.helper.js';
import {
  USER_DEFAULT_ROLE,
  PRIMARY_ADMIN_EMAIL,
  USERS_CSV_EXPORT_HEADERS,
} from '../../constants/permissions/permissions.constants.js';

export const buildUserFilter = ({ search, role, status }) => {
  const filter = { isDeleted: { $ne: true } };

  if (search) {
    const escapedSearch = escapeRegex(search);
    const searchRegex = new RegExp(escapedSearch, 'i');
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { userId: searchRegex },
    ];
  }

  if (role && role.toLowerCase() !== 'all') {
    filter.role = role;
  }

  if (status && status.toLowerCase() !== 'all') {
    const normalized = status.toLowerCase();
    if (normalized === 'active' || normalized === 'true') {
      filter.isActive = { $ne: false };
    } else if (normalized === 'inactive' || normalized === 'false') {
      filter.isActive = false;
    }
  }

  return filter;
};

export const getAllUsers = catchAsync(async (req, res) => {
  // 1. Parse pagination values using Number.parseInt with bounds checking
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 10));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

  // Calculate skip offset
  const skip = (page - 1) * limit;

  // Build filter criteria
  const filter = buildUserFilter({ search, role, status });

  // 2. Run database queries in parallel for efficiency
  const [users, totalUsers] = await Promise.all([
    GetAllUsers.find(filter)
      .select('-password -passwordResetToken -passwordResetExpires -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GetAllUsers.countDocuments(filter),
  ]);

  // Ensure every user has a userId display format
  const sanitizedUsers = users.map((u, index) => ({
    ...u,
    userId: u.userId || `TF${String(skip + index + 1).padStart(4, '0')}`,
    isActive: u.isActive !== false,
  }));

  // 3. Calculate total structural pages available
  const totalPages = Math.ceil(totalUsers / limit) || 1;

  // 4. Return formatted pagination response
  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalUsers,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: sanitizedUsers,
  });
});

export const createUserApiCall = catchAsync(async (req, res) => {
  // 1. Parse values from request body
  const { firstName, lastName, email, role, isActive } = req.body;
  const targetRole = role || USER_DEFAULT_ROLE;

  // 2. Only a Taskflow Admin may grant the Taskflow Admin role to guard against privilege escalation
  if (targetRole === 'Taskflow Admin' && req.user?.role !== 'Taskflow Admin') {
    return res.status(403).json({
      success: false,
      message: 'Only a Taskflow Admin can create another Taskflow Admin account.',
    });
  }

  // 3. Check if user already exists (among non-deleted records or active emails)
  const userExists = await GetAllUsers.findOne({ email }).lean();
  if (userExists && !userExists.isDeleted) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists. Please use a different email.',
    });
  }

  // 4. Generate a secure temporary 16-character random password
  const temporaryPassword = generateRandomHexToken(8);

  // 5. Create the new user record (pre-save hook assigns unique sequential userId and hashes password)
  const user = await GetAllUsers.create({
    firstName,
    lastName,
    email,
    role: targetRole,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    password: temporaryPassword,
    isDeleted: false,
  });

  // 6. Send the welcome email in the background
  try {
    await sendWelcomeEmail({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      plainPassword: temporaryPassword,
    });
  } catch (emailError) {
    console.error(`Email delivery failed for ${email}:`, emailError);
  }

  // 7. Trigger Notification
  const actorName = req.user
    ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Taskflow Admin'
    : 'Taskflow Admin';

  await createNotification({
    actor: req.user,
    type: 'user_created',
    title: 'New User Registered',
    message: `${user.firstName} ${user.lastName} (${user.role}) was added by ${actorName}.`,
    targetRole: 'All',
    recipientId: user._id,
    metadata: { userId: user.userId, email: user.email, role: user.role },
  });

  // 8. Respond with the created user details
  return res.status(201).json({
    success: true,
    message: 'User created successfully and credential email sent!',
    user: {
      id: (user._id || user.id || '1').toString(),
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      createdAt: user.createdAt,
    },
  });
});

export const getUserByIdApiCall = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await GetAllUsers.findOne({ _id: id, isDeleted: { $ne: true } })
    .select('-password -passwordResetToken -passwordResetExpires -refreshTokens')
    .lean();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      ...user,
      id: user._id.toString(),
      isActive: user.isActive !== false,
    },
  });
});

export const updateUserApiCall = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, role, email, isActive } = req.body;

  const user = await GetAllUsers.findOne({ _id: id, isDeleted: { $ne: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  // Only a Taskflow Admin may promote a user to Taskflow Admin
  if (role === 'Taskflow Admin' && req.user?.role !== 'Taskflow Admin') {
    return res.status(403).json({
      success: false,
      message: 'Only a Taskflow Admin can promote a user to Taskflow Admin.',
    });
  }

  // Protect primary Taskflow Admin account
  if (
    (user.role === 'Taskflow Admin' || user.email === PRIMARY_ADMIN_EMAIL) &&
    role &&
    role !== 'Taskflow Admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cannot demote the primary Taskflow Admin account.',
    });
  }

  // Check email uniqueness if email is changed
  if (email && email !== user.email) {
    const emailConflict = await GetAllUsers.findOne({
      email,
      _id: { $ne: id },
      isDeleted: { $ne: true },
    }).lean();

    if (emailConflict) {
      return res.status(400).json({
        success: false,
        message: 'Email is already in use by another member.',
      });
    }
    user.email = email;
  }

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (role) user.role = role;
  if (typeof isActive === 'boolean') user.isActive = isActive;

  await user.save();

  // Trigger Notification
  await createNotification({
    actor: req.user,
    type: 'user_updated',
    title: 'User Profile Updated',
    message:
      `${user.firstName} ${user.lastName}'s account was updated by ${req.user?.firstName || 'Taskflow Admin'} ${req.user?.lastName || ''}.`.trim(),
    targetRole: 'All',
    recipientId: user._id,
    metadata: { userId: user.userId, email: user.email },
  });

  return res.status(200).json({
    success: true,
    message: 'User updated successfully.',
    data: {
      id: user._id.toString(),
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      updatedAt: user.updatedAt,
    },
  });
});

export const deleteUserApiCall = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await GetAllUsers.findOne({ _id: id, isDeleted: { $ne: true } });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  // Prevent deleting the primary Taskflow Admin
  if (user.role === 'Taskflow Admin' || user.email === PRIMARY_ADMIN_EMAIL) {
    return res.status(403).json({
      success: false,
      message: 'Deletion prohibited: Taskflow Admin account cannot be deleted.',
    });
  }

  // Soft delete user
  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();

  // Trigger Notification
  await createNotification({
    actor: req.user,
    type: 'user_deleted',
    title: 'User Deactivated',
    message: `${user.firstName} ${user.lastName} was removed from the workspace.`,
    targetRole: 'Project Manager',
    metadata: { userId: user.userId, email: user.email },
  });

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully.',
  });
});

/**
 * GET /api/v1/users/export
 * Export users matching filters to CSV or JSON
 */
export const exportUsersApiCall = catchAsync(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const format =
    typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'json';

  const filter = buildUserFilter({ search, role, status });
  const users = await GetAllUsers.find(filter)
    .select('-password -passwordResetToken -passwordResetExpires -refreshTokens')
    .sort({ createdAt: -1 })
    .lean();

  const formattedUsers = users.map((u) => {
    const userId = u.userId || (u._id ? String(u._id) : 'N/A');
    const firstName = u.firstName || '';
    const lastName = u.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const status = u.isActive !== false ? 'Active' : 'Inactive';
    const joinedDate = u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A';

    return {
      userId,
      firstName,
      lastName,
      fullName,
      email: u.email || '',
      role: u.role || USER_DEFAULT_ROLE,
      status,
      isActive: u.isActive !== false,
      joinedDate,
      createdAt: u.createdAt,
    };
  });

  if (format === 'csv') {
    const headers = USERS_CSV_EXPORT_HEADERS;

    const rows = formattedUsers.map((u) => [
      u.userId,
      u.firstName,
      u.lastName,
      u.fullName,
      u.email,
      u.role,
      u.status,
      u.joinedDate,
    ]);

    const csvContent = '﻿' + serializeCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
    return res.status(200).send(csvContent);
  }

  return res.status(200).json({
    success: true,
    message: 'Users exported successfully.',
    total: formattedUsers.length,
    data: formattedUsers,
  });
});
