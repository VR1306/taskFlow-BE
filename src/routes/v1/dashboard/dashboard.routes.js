import { Router } from 'express';
import { getDashboardStats } from '../../../controllers/dashboard/dashboard.controller.js';
import { validateUserToken } from '../../../middlewares/protectedApi.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: System and workspace analytics dashboard endpoints
 */

/**
 * @swagger
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Get Real-Time Dashboard Statistics
 *     description: Retrieve real-time aggregated metrics, user & role distributions, trends, and recent activities for dashboard visualization.
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         inactiveUsers:
 *                           type: integer
 *                         totalRoles:
 *                           type: integer
 *                         systemRoles:
 *                           type: integer
 *                         customRoles:
 *                           type: integer
 *                         activeRoles:
 *                           type: integer
 *                         totalPermissions:
 *                           type: integer
 *                     usersByRole:
 *                       type: array
 *                       items:
 *                         type: object
 *                     usersByStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                     rolesByType:
 *                       type: array
 *                       items:
 *                         type: object
 *                     userRegistrationTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                     rolePermissionsDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentRoles:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *       500:
 *         description: Internal server error
 */
router.get('/stats', validateUserToken, getDashboardStats);

export default router;
