const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'omh-portal-dev-secret-change-in-prod';
const COOKIE_NAME = 'omh_portal_token';
const SESSION_DAYS = 14;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Director can only access their assigned centers
function requireCenterAccess(req, res, next) {
  if (req.user?.role === 'admin') return next(); // admins see all
  const db = require('./database');
  const centerId = parseInt(req.params.centerId || req.body?.center_id);
  if (!centerId) return res.status(400).json({ error: 'Center ID required' });
  const access = db.prepare('SELECT 1 FROM user_centers WHERE user_id = ? AND center_id = ?')
    .get(req.user.id, centerId);
  if (!access) return res.status(403).json({ error: 'No access to this center' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin, requireCenterAccess, COOKIE_NAME, SESSION_DAYS };
