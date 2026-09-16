// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import GetAllUsers from '../models/users/users.model.js';

// 1. Check if the user is logged in via JWT
export const validateUserToken = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header (Format: Bearer <token>)
    if (req.headers.authorization) {
      const authHeader = req.headers.authorization.trim();
      if (authHeader.startsWith('Bearer')) {
        // Extract everything after the last 'Bearer ' word and strip quotes/whitespace
        token = authHeader
          .replace(/^Bearer\s+/i, '')
          .replace(/^["']|["']$/g, '')
          .trim();
      } else {
        token = authHeader.replace(/^["']|["']$/g, '').trim();
      }
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'You are not logged in. Please log in to get access.' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the user still exists in the database
    const currentUser = await GetAllUsers.findById(decoded.id);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: 'The user belonging to this token no longer exists.' });
    }

    // Grant access to the protected route by attaching the user object to the request
    req.user = currentUser;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid token. Access denied.', error: error.message });
  }
};
