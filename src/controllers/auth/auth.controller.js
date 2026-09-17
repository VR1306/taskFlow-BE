import {
  generateAuthTokens,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  generateRandomHexToken,
  hashToken,
  catchAsync,
} from '../../helpers/helpers.js';
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

  const { accessToken, refreshToken } = generateAuthTokens(user);

  // Store refresh token in user document (retaining up to 10 active sessions)
  if (!Array.isArray(user.refreshTokens)) {
    user.refreshTokens = [];
  }
  user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
  if (user.refreshTokens.length > 10) {
    user.refreshTokens = user.refreshTokens.slice(-10);
  }
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: 'Sign-in successful!',
    token: accessToken,
    accessToken,
    refreshToken,
    defaultModule: 'users',
    redirectUrl: '/users',
    user: {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
});

// API controller for Refreshing Access Token
export const refreshTokenApiCall = catchAsync(async (req, res) => {
  const incomingRefreshToken =
    req.body.refreshToken ||
    req.headers['x-refresh-token'] ||
    (req.cookies && req.cookies.refreshToken);

  if (!incomingRefreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  // 1. Verify cryptographic validity & expiration of refresh token
  const decoded = verifyRefreshToken(incomingRefreshToken);
  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid or expired refresh token. Please sign in again.',
    });
  }

  // 2. Locate user
  const user = await GetAllUsers.findById(decoded.id);
  if (!user) {
    return res.status(401).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'User belonging to this token no longer exists.',
    });
  }

  // 3. Verify token presence in user's active refresh tokens
  const tokenIndex = (user.refreshTokens || []).findIndex(
    (item) => item.token === incomingRefreshToken
  );

  if (tokenIndex === -1) {
    // If token not found, possible token reuse / breach -> clear tokens as safeguard
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({
      success: false,
      code: 'TOKEN_REVOKED',
      message: 'Refresh token has been revoked or invalidated. Please sign in again.',
    });
  }

  // 4. Rotate tokens: generate new access and refresh token
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Update rotated refresh token in user record
  user.refreshTokens[tokenIndex] = { token: newRefreshToken, createdAt: new Date() };
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: 'Token refreshed successfully!',
    token: newAccessToken,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// API controller for Logout (Revoking Refresh Token)
export const logoutUserApiCall = catchAsync(async (req, res) => {
  const incomingRefreshToken =
    req.body?.refreshToken ||
    req.headers['x-refresh-token'] ||
    (req.cookies && req.cookies.refreshToken);

  const userId = req.user?._id || req.user?.id;

  if (incomingRefreshToken) {
    const decoded = verifyRefreshToken(incomingRefreshToken);
    const targetUserId = userId || decoded?.id;
    if (targetUserId) {
      const user = await GetAllUsers.findById(targetUserId);
      if (user && Array.isArray(user.refreshTokens)) {
        user.refreshTokens = user.refreshTokens.filter(
          (item) => item.token !== incomingRefreshToken
        );
        await user.save({ validateBeforeSave: false });
      }
    }
  } else if (userId) {
    const user = await GetAllUsers.findById(userId);
    if (user) {
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
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
  const rawResetToken = generateRandomHexToken(32);

  // 2. Hash the raw token and store it securely in the database
  user.passwordResetToken = hashToken(rawResetToken);

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
  const hashedToken = hashToken(token);

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
