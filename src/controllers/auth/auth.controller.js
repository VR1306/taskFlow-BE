import { generateToken, catchAsync } from "../../helpers/helpers.js";
import { sendPasswordResetEmail } from "../../helpers/sendEmail.js";
import GetAllUsers from "../../models/users/users.model.js";
import crypto from 'crypto';

// Api controller for Sign In 
export const signInUserApiCall = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  
  const user = await GetAllUsers.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = generateToken(user);

  return res.status(200).json({
    success: true,
    message: 'Sign-in successful!',
    token,
    user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email }
  });
});

// Api controller for Forgot Password Email Verification
export const forgotPasswordEmailVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await GetAllUsers.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // 1. Generate a raw, random 32-byte reset token
  const rawResetToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the raw token and store it securely in the database
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(rawResetToken)
    .digest('hex');

  // 3. Set the expiration window (e.g., Current time + 10 minutes)
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; 

  // Save changes to the user document (skipping validation rules if any fail)
  await user.save({ validateBeforeSave: false });

  // 4. Construct the reset URL pointing to your frontend recovery page with query params
  const resetUrl = `${process.env.CLIENT_URL}/auth/reset-password?token=${rawResetToken}`;

  // 5. Fire off the reset email asynchronously
  try {
    await sendPasswordResetEmail({
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
      email: user.email,
      resetUrl: resetUrl
    });

    return res.status(200).json({
      success: true,
      message: "Password reset link successfully dispatched to your email address!"
    });
  } catch (emailError) {
    // If email delivery breaks, rollback database tracking properties immediately
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({ 
      message: "Error sending the email. Try again later.", 
      error: emailError.message 
    });
  }
});

// Api controller for resetting the password using token
export const resetPasswordFunction = catchAsync(async (req, res, next) => {
  const { password, confirmPassword } = req.body;
  // Extract token from query params (e.g. ?token=XYZ), URL params, or body
  const token = req.query.token || req.params.token || req.body.token;

  if (!token) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  // Hash the raw token to match the database hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await GetAllUsers.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Token is invalid or has expired" });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password reset successful! You can now log in with your new password."
  });
});

// Api controller for changing the password (Authenticated User)
export const changePasswordFunction = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?._id || req.user?.id;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New passwords do not match" });
  }

  const user = await GetAllUsers.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password changed successfully!"
  });
});