import { Router } from 'express';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { requirePermission } from '../../../helpers/permissions.helper.js';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectMemberCandidates,
} from '../../../controllers/projects/projects.controller.js';

const router = Router();

router.use(validateUserToken);

router.get('/member-candidates', requirePermission('projects.view'), getProjectMemberCandidates);
router.get('/', requirePermission('projects.view'), getAllProjects);
router.get('/:id', requirePermission('projects.view'), getProjectById);
router.post('/', requirePermission('projects.create'), createProject);
router.put('/:id', requirePermission('projects.edit'), updateProject);
router.delete('/:id', requirePermission('projects.delete'), deleteProject);

export default router;
