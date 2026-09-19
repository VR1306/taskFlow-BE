import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/users.routes.js';
import roleRoutes from './roles/roles.routes.js';
import dashboardRoutes from './dashboard/dashboard.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
