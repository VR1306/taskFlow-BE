import { catchAsync, generateRandomHexToken, escapeRegex } from '../../helpers/helpers.js';
import { sendWelcomeEmail } from '../../helpers/sendEmail.js';
import GetAllUsers from '../../models/users/users.model.js';

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

  // 2. Check if user already exists (among non-deleted records or active emails)
  const userExists = await GetAllUsers.findOne({ email }).lean();
  if (userExists && !userExists.isDeleted) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists. Please use a different email.',
    });
  }

  // 3. Generate a secure temporary 16-character random password
  const temporaryPassword = generateRandomHexToken(8);

  // 4. Create the new user record (pre-save hook assigns unique sequential userId and hashes password)
  const user = await GetAllUsers.create({
    firstName,
    lastName,
    email,
    role: role || 'User',
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    password: temporaryPassword,
    isDeleted: false,
  });

  // 5. Send the welcome email in the background
  try {
    await sendWelcomeEmail({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      plainPassword: temporaryPassword,
    });
  } catch (emailError) {
    console.error(`Email delivery failed for ${email}:`, emailError);
  }

  // 6. Respond with the created user details
  return res.status(201).json({
    success: true,
    message: 'User created successfully and credential email sent!',
    user: {
      id: user._id.toString(),
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

  // Protect SuperAdmin account
  if (
    (user.role === 'SuperAdmin' || user.email === 'vijayaraghavan130699@gmail.com') &&
    role &&
    role !== 'SuperAdmin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cannot demote the primary SuperAdmin account.',
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

  // Prevent deleting SuperAdmin
  if (user.role === 'SuperAdmin' || user.email === 'vijayaraghavan130699@gmail.com') {
    return res.status(403).json({
      success: false,
      message: 'Deletion prohibited: SuperAdmin account cannot be deleted.',
    });
  }

  // Soft delete user
  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully.',
  });
});
