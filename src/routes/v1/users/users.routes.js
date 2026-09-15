import { Router } from 'express';
import { getAllUsers, createUserApiCall } from '../../../controllers/users/users.controller.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import createUserValidationSchema from '../../../models/users/createUsers.model.js';

const router = Router();

router.get('/getAllUsers', validateUserToken, getAllUsers);
router.post('/createUser', validateUserToken, validateRequest(createUserValidationSchema), createUserApiCall);

export default router;
