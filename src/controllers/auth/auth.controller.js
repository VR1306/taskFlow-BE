import crypto from 'node:crypto';
import { generateToken, catchAsync } from '../../helpers/helpers.js';
import { sendPasswordResetEmail } from '../../helpers/sendEmail.js';
import GetAllUsers from '../../models/users/users.model.js';

const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// API controller for Sign In
export const signInUserApiCall = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await GetAllUsers.findOne({ email });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  const token = generateToken(user);

  return res.status(200).json({
    success: true,
    message: 'Sign-in successful!',
    token,
    user: {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
});

// API controller for Forgot Password Email Verification
export const forgotPasswordEmailVerification = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = await GetAllUsers.findOne({ email });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // 1. Generate a raw, random 32-byte reset token
  const rawResetToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the raw token and store it securely in the database
  user.passwordResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

  // 3. Set the expiration window (10 minutes)
  user.passwordResetExpires = Date.now() + RESET_TOKEN_EXPIRY_MS;

  // Save changes to the user document
  await user.save({ validateBeforeSave: false });

  // 4. Construct the reset URL pointing to frontend recovery page
  const clientUrlEnv =
    process.env.RESET_PASSWORD_CLIENT_URL ||
    process.env.CLIENT_URL ||
    'https://taskflow-fe-beryl.vercel.app';
  const rawClientUrl = clientUrlEnv.split(',')[0].trim() || 'https://taskflow-fe-beryl.vercel.app';
  const cleanClientUrl = rawClientUrl.endsWith('/') ? rawClientUrl.slice(0, -1) : rawClientUrl;
  const resetUrl = `${cleanClientUrl}/auth/reset-password?token=${rawResetToken}`;

  // 5. Fire off the reset email asynchronously
  try {
    await sendPasswordResetEmail({
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
      email: user.email,
      resetUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset link successfully dispatched to your email address!',
    });
  } catch (emailError) {
    // Rollback reset token on email delivery failure
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    console.error('Password reset email delivery failure:', emailError);
    return res.status(500).json({
      success: false,
      message: 'Error sending the email. Try again later.',
      error: emailError.message,
    });
  }
});

// API controller for resetting the password using token
export const resetPasswordFunction = catchAsync(async (req, res) => {
  const { password, confirmPassword } = req.body;
  const token = req.query.token || req.params.token || req.body.token;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Reset token is required' });
  }

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  // Hash the incoming token to match database hash
  const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

  const user = await GetAllUsers.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(401).json({ success: false, message: 'Token is invalid or has expired' });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Password reset successful! You can now log in with your new password.',
  });
});

// API controller for changing the password (Authenticated User)
export const changePasswordFunction = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?._id || req.user?.id;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New passwords do not match' });
  }

  const user = await GetAllUsers.findById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully!',
  });
});
