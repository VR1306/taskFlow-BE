import { Router } from 'express';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import SignInSchema from '../../../models/auth/signIn.model.js';
import { forgotPasswordEmailVerification, resetPasswordFunction, signInUserApiCall, changePasswordFunction } from '../../../controllers/auth/auth.controller.js';
import ForgotPasswordSchema from '../../../models/auth/forgotPassword.model.js';
import ResetPasswordSchema from '../../../models/auth/resetPassword.model.js';
import ChangePasswordSchema from '../../../models/auth/changePassword.model.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & Password Recovery endpoints
 */

/**
 * @swagger
 * /api/v1/auth/signIn:
 *   post:
 *     summary: User Login / Sign In
 *     description: Authenticate user with email & password to receive a JWT bearer token.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: vijayaraghavan130699@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SuperAdmin@123
 *     responses:
 *       200:
 *         description: Sign-in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Sign-in successful!
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Email and password required or invalid payload
 *       401:
 *         description: Invalid password
 *       404:
 *         description: User not found
 */
router.post('/signIn', validateRequest(SignInSchema), signInUserApiCall);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request Password Reset Link
 *     description: Sends a secure password reset link to the registered email address.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset email dispatched
 *       400:
 *         description: Email is required or invalid
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', validateRequest(ForgotPasswordSchema), forgotPasswordEmailVerification);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset Password using Reset Token
 *     description: Reset user account password using the token sent in the reset email.
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: false
 *         description: Raw 32-byte reset token from the reset URL query string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Reset token (optional in body if supplied as query param)
 *                 example: 3a9f4c8e7b1a2d6f5c8e7d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePassword@123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePassword@123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Token is invalid, expired, or passwords do not match
 */
router.post('/reset-password', validateRequest(ResetPasswordSchema), resetPasswordFunction);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change Password (Authenticated)
 *     description: Allows an authenticated user to change their current password.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: OldPassword@123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewStrongPassword@456
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewStrongPassword@456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Passwords do not match or fields missing
 *       401:
 *         description: Unauthorized or current password incorrect
 *       404:
 *         description: User not found
 */
router.post('/change-password', validateUserToken, validateRequest(ChangePasswordSchema), changePasswordFunction);

export default router;