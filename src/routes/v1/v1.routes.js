import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/users.routes.js';
import roleRoutes from './roles/roles.routes.js';
import dashboardRoutes from './dashboard/dashboard.routes.js';
import notificationRoutes from './notifications/notifications.routes.js';
import projectRoutes from './projects/projects.routes.js';
import taskRoutes from './tasks/tasks.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);

export default router;
