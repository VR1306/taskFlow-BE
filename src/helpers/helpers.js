import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

export const generateAccessToken = (user) => {
  const payload = {
    id: (user._id || user.id || user).toString(),
    ...(typeof user === 'object' && {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    }),
  };

  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';

  return jwt.sign(payload, secret, { expiresIn });
};

export const generateRefreshToken = (user, rememberMe = false) => {
  const userId = (user._id || user.id || user).toString();
  const payload = { id: userId, type: 'refresh', rememberMe: Boolean(rememberMe) };

  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const defaultExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const expiresIn = rememberMe
    ? process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || '30d'
    : defaultExpiry;

  return jwt.sign(payload, secret, { expiresIn });
};

export const generateAuthTokens = (user, rememberMe = false) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);

  return {
    accessToken,
    refreshToken,
  };
};

export const generateToken = (user) => generateAccessToken(user);

export const verifyAccessToken = (token) => {
  try {
    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

export const verifyToken = (token) => verifyAccessToken(token);

export const escapeRegex = (string) => {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};

export const generateRandomHexToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

export const extractBearerToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;

  const trimmed = authHeader.trim();
  if (trimmed.startsWith('Bearer')) {
    return trimmed
      .replace(/^Bearer\s+/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
  return trimmed.replace(/^["']|["']$/g, '').trim();
};

export const getDatabaseStatus = (readyState) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[readyState] || 'unknown';
};

export const parseAllowedOrigins = () => {
  const envOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
    : [];
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    ...envOrigins,
  ].filter(Boolean);
};

export const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = parseAllowedOrigins();
  if (allowed.includes(origin) || allowed.includes('*')) {
    return true;
  }
  return (
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
};

export const catchAsync = (fn) => {
  return (req, res, next) => {
    return fn(req, res, next).catch((err) => {
      // A MongoDB unique-index violation (e.g. two requests racing past an application-level
      // "already exists" check, or a check that doesn't fully match the index) should read as
      // a normal validation failure, not leak a raw driver error behind a 500.
      if (err?.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        const label = field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Value';
        return res.status(400).json({
          success: false,
          message: field
            ? `${label} already exists. Please use a different ${field}.`
            : 'A record with this value already exists.',
        });
      }

      // Automatically forwards the error to your global Express error handler
      return res.status(500).json({
        success: false,
        message: 'Internal Database Server Error',
        error: err.message,
      });
    });
  };
};

export const escapeCsvValue = (str) => {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
};

export const serializeCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return [headerLine, ...rowLines].join('\n');
};
