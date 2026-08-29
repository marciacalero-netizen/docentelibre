const jwt = require('jsonwebtoken');
const { settingsRef } = require('../firestore');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const snap = await settingsRef.get();
    const settings = snap.data();
    jwt.verify(token, settings.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

module.exports = requireAuth;
