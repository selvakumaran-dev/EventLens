import jwt from 'jsonwebtoken';

/**
 * verifyGuestToken
 * ─────────────────
 * Express middleware that validates the JWT attached by the guest after login.
 * The token must be sent as:  Authorization: Bearer <token>
 *
 * On success  → attaches `req.guest = { eventId, iat, exp }` and calls next()
 * On failure  → returns 401 Unauthorized
 */
export const verifyGuestToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.guest = decoded; // { eventId, iat, exp }
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid token.';

    return res.status(401).json({ success: false, message });
  }
};

/**
 * verifyAdminToken
 * ─────────────────
 * Identical structure but checks for the `role: 'admin'` claim.
 * Protects admin-only routes (event creation, metadata upload).
 */
export const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Admin access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin privileges required.',
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Admin session expired. Please re-authenticate.'
        : 'Invalid admin token.';

    return res.status(401).json({ success: false, message });
  }
};
