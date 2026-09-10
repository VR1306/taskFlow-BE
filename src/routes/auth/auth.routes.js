import { Router } from 'express';
import { validateRequest } from '../../middlewares/validateSchema';
import SignInSchema from '../../models/auth/signIn.model';
import { SignInUserApiCall } from '../../controllers/auth/auth.controller';
const router = Router();

router.post('/auth/signIn', validateRequest(SignInSchema), SignInUserApiCall);