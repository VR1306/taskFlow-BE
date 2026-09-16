import jwt from 'jsonwebtoken';

export const generateToken = (user) => {
  const payload = {
    id: (user._id || user.id || user).toString(),
    ...(typeof user === 'object' && {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    }),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    return null;
  }
};

export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      // Automatically forwards the error to your global Express error handler
      return res.status(500).json({
        success: false,
        message: 'Internal Database Server Error',
        error: err.message,
      });
    });
  };
};
