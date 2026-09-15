import { catchAsync } from "../../helpers/helpers.js";
import { sendWelcomeEmail } from "../../helpers/sendEmail.js";
import GetAllUsers from "../../models/users/users.model.js";
import crypto from 'crypto';
export const getAllUsers = catchAsync(async (req, res, next) => {
  // 1. Parse pagination values from req.query (with default fallbacks)
  // Converting strings to numbers using radix 10
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  
  // Calculate how many documents the database needs to skip over
  const skip = (page - 1) * limit;

  // 2. Run database queries in parallel to save processing time
  const [users, totalUsers] = await Promise.all([
    GetAllUsers.find().select('-password').skip(skip).limit(limit),
    GetAllUsers.countDocuments() // Get the absolute total number of users in the system
  ]);

  // 3. Calculate total structural pages available
  const totalPages = Math.ceil(totalUsers / limit);

  // 4. Construct response with comprehensive pagination data
  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalUsers,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: users
  });
});


export const createUserApiCall = catchAsync(async (req, res, next) => {
  // 1. Parse values from request body
  const { firstName, lastName, email, role } = req.body;

  // 2. Check if user already exists
  const userExists = await GetAllUsers.findOne({ email });
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'Email already exists. Please use a different email.'
    });
  }

  // Generate a temporary 8-character random password automatically
  const temporaryPassword = crypto.randomBytes(4).toString('hex');

  // 3. Create the new user record (Includes generated password)
  const user = await GetAllUsers.create({
    firstName,
    lastName,
    email,
    role,
    password: temporaryPassword // This gets automatically hashed by your Mongoose pre-save hook!
  });

  // 4. Send the welcome email in the background
  try {
    await sendWelcomeEmail({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      plainPassword: temporaryPassword // Send the plain text version so they can read it
    });
  } catch (emailError) {
    console.error(`🚨 Email delivery failed for ${email}:`, emailError.message);
  }

  // 5. Respond with the newly created user details
  return res.status(201).json({
    success: true,
    message: 'User created successfully and credential email sent!',
    user: { 
      id: user._id, 
      firstName: user.firstName, 
      lastName: user.lastName, 
      email: user.email,
      role: user.role 
    }
  });
});
