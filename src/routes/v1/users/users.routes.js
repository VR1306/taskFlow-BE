import { Router } from 'express';
import {
  getAllUsers,
  createUserApiCall,
  getUserByIdApiCall,
  updateUserApiCall,
  deleteUserApiCall,
  exportUsersApiCall,
} from '../../../controllers/users/users.controller.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import createUserValidationSchema from '../../../models/users/createUsers.model.js';
import updateUserValidationSchema from '../../../models/users/updateUsers.model.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User Management endpoints
 */

/**
 * @swagger
 * /api/v1/users/export:
 *   get:
 *     summary: Export Users to CSV or JSON
 *     description: Retrieve all matching users in CSV or JSON format.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 */
router.get('/export', validateUserToken, exportUsersApiCall);

/**
 * @swagger
 * /api/v1/users/getAllUsers:
 *   get:
 *     summary: Get All Users (Paginated)
 *     description: Retrieve a paginated list of non-deleted users in the system. Requires valid Bearer JWT.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query matching name, email, or user ID
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SuperAdmin, Admin, Manager, User, all]
 *         description: Filter users by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive, all]
 *         description: Filter users by account status
 *     responses:
 *       200:
 *         description: Successfully fetched users list
 *       401:
 *         description: Unauthorized
 */
router.get('/getAllUsers', validateUserToken, getAllUsers);

/**
 * @swagger
 * /api/v1/users/createUser:
 *   post:
 *     summary: Create a New User
 *     description: Create a user and automatically dispatch a temporary credential welcome email. Requires valid Bearer JWT.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [User, Admin, SuperAdmin]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or Email already exists
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/createUser',
  validateUserToken,
  validateRequest(createUserValidationSchema),
  createUserApiCall
);

/**
 * @swagger
 * /api/v1/users/getUserById/{id}:
 *   get:
 *     summary: Get User By ID
 *     description: Retrieve user details by database ID. Requires valid Bearer JWT.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user _id
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/getUserById/:id', validateUserToken, getUserByIdApiCall);

/**
 * @swagger
 * /api/v1/users/updateUser/{id}:
 *   put:
 *     summary: Update User Details
 *     description: Update a user's details by database ID. Requires valid Bearer JWT.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put(
  '/updateUser/:id',
  validateUserToken,
  validateRequest(updateUserValidationSchema),
  updateUserApiCall
);

/**
 * @swagger
 * /api/v1/users/deleteUser/{id}:
 *   delete:
 *     summary: Soft Delete User
 *     description: Soft delete a user record by database ID. Requires valid Bearer JWT.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user _id
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Cannot delete SuperAdmin
 *       404:
 *         description: User not found
 */
router.delete('/deleteUser/:id', validateUserToken, deleteUserApiCall);

export default router;
