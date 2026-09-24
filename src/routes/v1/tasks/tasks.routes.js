import { Router } from 'express';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { requirePermission } from '../../../helpers/permissions.helper.js';
import {
  getAllTasks,
  getBoardTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskActivity,
} from '../../../controllers/tasks/tasks.controller.js';
import {
  getTaskComments,
  createTaskComment,
  deleteTaskComment,
} from '../../../controllers/comments/comments.controller.js';
import {
  getTaskAttachments,
  uploadTaskAttachment,
  downloadTaskAttachment,
  deleteTaskAttachment,
  uploadMiddleware,
} from '../../../controllers/attachments/attachments.controller.js';

const router = Router();

router.use(validateUserToken);

router.get('/board', requirePermission('tasks.view'), getBoardTasks);
router.get('/', requirePermission('tasks.view'), getAllTasks);
router.get('/:id', requirePermission('tasks.view'), getTaskById);
router.post('/', requirePermission('tasks.create'), createTask);
router.put('/:id', requirePermission('tasks.edit'), updateTask);
router.patch('/:id/status', requirePermission('tasks.edit'), updateTaskStatus);
router.delete('/:id', requirePermission('tasks.delete'), deleteTask);

router.get('/:id/activity', requirePermission('tasks.view'), getTaskActivity);

router.get('/:id/comments', requirePermission('tasks.view'), getTaskComments);
router.post('/:id/comments', requirePermission('tasks.view'), createTaskComment);
router.delete('/:id/comments/:commentId', requirePermission('tasks.view'), deleteTaskComment);

router.get('/:id/attachments', requirePermission('tasks.view'), getTaskAttachments);
router.post(
  '/:id/attachments',
  requirePermission('tasks.edit'),
  uploadMiddleware,
  uploadTaskAttachment
);
router.get(
  '/:id/attachments/:attachmentId',
  requirePermission('tasks.view'),
  downloadTaskAttachment
);
router.delete(
  '/:id/attachments/:attachmentId',
  requirePermission('tasks.edit'),
  deleteTaskAttachment
);

export default router;
