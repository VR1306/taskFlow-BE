import { Router } from 'express';
import { getAllUsers, createUserApiCall } from '../../../controllers/users/users.controller.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';
import { validateRequest } from '../../../middlewares/validateSchema.js';
import createUserValidationSchema from '../../../models/users/createUsers.model.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User Management endpoints
 */

/**
 * @swagger
 * /api/v1/users/getAllUsers:
 *   get:
 *     summary: Get All Users (Paginated)
 *     description: Retrieve a paginated list of users in the system. Requires valid Bearer JWT.
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
 *     responses:
 *       200:
 *         description: Successfully fetched users list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [User, Admin, SuperAdmin]
 *       401:
 *         description: Unauthorized - missing or invalid token
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
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               role:
 *                 type: string
 *                 enum: [User, Admin, SuperAdmin]
 *                 default: User
 *                 example: User
 *     responses:
 *       201:
 *         description: User created successfully and credential email sent
 *       400:
 *         description: Email already exists or validation error
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.post('/createUser', validateUserToken, validateRequest(createUserValidationSchema), createUserApiCall);

export default router;

