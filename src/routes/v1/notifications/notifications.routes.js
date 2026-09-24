import { Router } from 'express';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../../controllers/notifications/notifications.controller.js';

const router = Router();

router.use(validateUserToken);

router.get('/unread-count', getUnreadNotificationsCount);
router.get('/', getNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.post('/read-all', markAllNotificationsAsRead);
router.delete('/:id', deleteNotification);

export default router;
