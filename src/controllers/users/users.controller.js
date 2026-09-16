import { catchAsync } from '../../helpers/helpers.js';
import { sendWelcomeEmail } from '../../helpers/sendEmail.js';
import GetAllUsers from '../../models/users/users.model.js';
import crypto from 'node:crypto';

export const getAllUsers = catchAsync(async (req, res) => {
  // 1. Parse pagination values using Number.parseInt with bounds checking
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 10));

  // Calculate skip offset
  const skip = (page - 1) * limit;

  // 2. Run database queries in parallel for efficiency
  const [users, totalUsers] = await Promise.all([
    GetAllUsers.find().select('-password').skip(skip).limit(limit).lean(),
    GetAllUsers.countDocuments(),
  ]);

  // 3. Calculate total structural pages available
  const totalPages = Math.ceil(totalUsers / limit);

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
    data: users,
  });
});

export const createUserApiCall = catchAsync(async (req, res) => {
  // 1. Parse values from request body
  const { firstName, lastName, email, role } = req.body;

  // 2. Check if user already exists
  const userExists = await GetAllUsers.findOne({ email }).lean();
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists. Please use a different email.',
    });
  }

  // 3. Generate a secure temporary 16-character random password
  const temporaryPassword = crypto.randomBytes(8).toString('hex');

  // 4. Create the new user record (Password automatically hashed in Mongoose pre-save)
  const user = await GetAllUsers.create({
    firstName,
    lastName,
    email,
    role,
    password: temporaryPassword,
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
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
});
