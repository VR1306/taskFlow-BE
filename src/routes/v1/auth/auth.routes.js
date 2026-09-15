import { Router } from 'express';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import SignInSchema from '../../../models/auth/signIn.model.js';
import { forgotPasswordEmailVerification, resetPasswordFunction, signInUserApiCall, changePasswordFunction } from '../../../controllers/auth/auth.controller.js';
import ForgotPasswordSchema from '../../../models/auth/forgotPassword.model.js';
import ResetPasswordSchema from '../../../models/auth/resetPassword.model.js';
import ChangePasswordSchema from '../../../models/auth/changePassword.model.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';

const router = Router();

router.post('/signIn', validateRequest(SignInSchema), signInUserApiCall);
router.post('/forgot-password', validateRequest(ForgotPasswordSchema), forgotPasswordEmailVerification);
router.post('/reset-password', validateRequest(ResetPasswordSchema), resetPasswordFunction);
router.post('/change-password', validateUserToken, validateRequest(ChangePasswordSchema), changePasswordFunction);

export default router;