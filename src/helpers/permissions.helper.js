import mongoose from 'mongoose';
import Role from '../models/roles/roles.model.js';

/**
 * Resolves the permission IDs granted to a role by name.
 * Returns an empty array when there is no live DB connection and the
 * lookup isn't mocked (e.g. unit tests that don't exercise this path),
 * mirroring the guard used by the seeding helpers.
 */
export const getPermissionsForRole = async (roleName) => {
  if (!roleName) return [];
  try {
    if (mongoose.connection.readyState === 0 && !Role.findOne.mock) {
      return [];
    }
    const role = await Role.findOne({ name: roleName, isDeleted: { $ne: true } }).lean();
    return role?.permissions || [];
  } catch {
    return [];
  }
};

/**
 * Checks whether a request-scoped user (with a `permissions` array attached
 * by validateUserToken) has been granted a given permission ID.
 */
export const hasPermission = (user, permissionId) => {
  return Array.isArray(user?.permissions) && user.permissions.includes(permissionId);
};

/**
 * Express middleware factory: rejects the request with 403 unless the
 * authenticated user's role grants the given permission ID.
 */
export const requirePermission = (permissionId) => (req, res, next) => {
  if (!hasPermission(req.user, permissionId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: you do not have permission to perform this action.',
    });
  }
  return next();
};

export default requirePermission;
