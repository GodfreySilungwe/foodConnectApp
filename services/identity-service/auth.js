const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'foodconnect-development-secret';

function requireAuth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    try {
      req.user = jwt.verify(token, secret);
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (requiredRole && !requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  };
}

module.exports = { requireAuth };
