const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  const settings = db.prepare('SELECT jwt_secret FROM settings WHERE id = 1').get();
  try {
    jwt.verify(token, settings.jwt_secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

module.exports = requireAuth;
