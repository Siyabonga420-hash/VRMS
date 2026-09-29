// middleware/auth.js
const jwt = require('jsonwebtoken');

// Reads "Authorization: Bearer <token>", verifies it, and attaches
// the decoded payload ({ id, role }) to req.user for later routes to use.
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Not logged in.' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired, please log in again.' });
    }
}

// Usage: requireRole('staff', 'admin') -- only lets those roles through.
// Must run AFTER requireAuth, since it reads req.user.
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to do that.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
