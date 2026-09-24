import jwt from 'jsonwebtoken';
import GetAllUsers from '../models/users/users.model.js';
import { extractBearerToken } from '../helpers/helpers.js';
import { getPermissionsForRole } from '../helpers/permissions.helper.js';

// 1. Check if the user is logged in via JWT
export const validateUserToken = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers?.authorization);

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'You are not logged in. Please log in to get access.' });
    }

    // Verify the token
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Check if the user still exists in the database
    const currentUser = await GetAllUsers.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Attach the caller's granted permissions so downstream routes can
    // authorize by permission ID instead of hardcoded role-name checks.
    currentUser.permissions = await getPermissionsForRole(currentUser.role);

    // Grant access to the protected route by attaching the user object to the request
    req.user = currentUser;
    next();
  } catch (error) {
    const isExpired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired
        ? 'Access token has expired. Please refresh your token.'
        : 'Invalid token. Access denied.',
      error: error.message,
    });
  }
};
