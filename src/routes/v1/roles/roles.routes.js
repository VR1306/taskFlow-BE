import { Router } from 'express';
import {
  getPermissionsCatalogue,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  exportRoles,
} from '../../../controllers/roles/roles.controller.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import { requirePermission } from '../../../helpers/permissions.helper.js';
import createRoleValidationSchema from '../../../models/roles/createRole.model.js';
import updateRoleValidationSchema from '../../../models/roles/updateRole.model.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role and Access Control Management endpoints
 */

/**
 * @swagger
 * /api/v1/roles/permissions:
 *   get:
 *     summary: Get System Permissions Catalogue
 *     description: Retrieve all available system permissions grouped by functional module for dynamic UI display.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions catalogue retrieved successfully
 */
router.get('/permissions', validateUserToken, getPermissionsCatalogue);

/**
 * @swagger
 * /api/v1/roles/export:
 *   get:
 *     summary: Export Roles to CSV or JSON
 *     description: Retrieve all matching roles in CSV or JSON format.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 */
router.get('/export', validateUserToken, requirePermission('roles.view'), exportRoles);

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: Get All Roles (Paginated)
 *     description: Retrieve paginated list of non-deleted roles with search and filtering.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: roleType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated roles list
 */
router.get('/', validateUserToken, requirePermission('roles.view'), getAllRoles);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Get Role Details by ID
 *     description: Retrieve single role details by MongoDB ObjectId or formatted roleId.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role details
 *       404:
 *         description: Role not found
 */
router.get('/:id', validateUserToken, requirePermission('roles.view'), getRoleById);

/**
 * @swagger
 * /api/v1/roles:
 *   post:
 *     summary: Create New Role
 *     description: Create a new custom role with designated permissions.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               roleType:
 *                 type: string
 *                 enum: [Taskflow Admin, Project Manager, Developer, QA, Custom]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Validation error or duplicate role name
 */
router.post(
  '/',
  validateUserToken,
  requirePermission('roles.create'),
  validateRequest(createRoleValidationSchema),
  createRole
);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   put:
 *     summary: Update Existing Role
 *     description: Update role metadata, permissions, and active status.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 */
router.put(
  '/:id',
  validateUserToken,
  requirePermission('roles.edit'),
  validateRequest(updateRoleValidationSchema),
  updateRole
);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   delete:
 *     summary: Delete Role
 *     description: Soft-delete role if it is not a system role and has no active assigned users.
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       400:
 *         description: Cannot delete system role or role in use
 *       404:
 *         description: Role not found
 */
router.delete('/:id', validateUserToken, requirePermission('roles.delete'), deleteRole);

export default router;
