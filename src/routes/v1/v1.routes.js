import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
