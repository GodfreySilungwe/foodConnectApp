const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'foodconnect-development-secret';

function requireAuth(requiredRole) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    try {
      req.user = jwt.verify(token, secret);
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (requiredRole && !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (process.env.IDENTITY_SERVICE_URL) {
      try {
        const identityUrl = process.env.IDENTITY_SERVICE_URL.replace(/\/$/, '');
        const response = await fetch(`${identityUrl}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return res.status(response.status === 401 ? 401 : 403).json({ success: false, error: 'This account is inactive' });
      } catch (error) {
        return res.status(503).json({ success: false, error: 'Identity service is unavailable' });
      }
    }
    return next();
  };
}

module.exports = { requireAuth };
