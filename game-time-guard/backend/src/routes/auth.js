const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attemptsByIp = new Map();

function tooManyAttempts(ip) {
  const entry = attemptsByIp.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    attemptsByIp.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailedAttempt(ip) {
  const entry = attemptsByIp.get(ip);
  if (!entry || Date.now() - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

router.post('/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' });
  }

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Falta la clave' });

  const settings = db.prepare('SELECT admin_password_hash, jwt_secret FROM settings WHERE id = 1').get();
  const ok = bcrypt.compareSync(password, settings.admin_password_hash);
  if (!ok) {
    registerFailedAttempt(ip);
    return res.status(401).json({ error: 'Clave incorrecta' });
  }

  attemptsByIp.delete(ip);
  const token = jwt.sign({ role: 'admin' }, settings.jwt_secret, { expiresIn: '12h' });
  res.json({ token });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva clave debe tener al menos 6 caracteres' });
  }

  const settings = db.prepare('SELECT admin_password_hash FROM settings WHERE id = 1').get();
  const ok = bcrypt.compareSync(currentPassword, settings.admin_password_hash);
  if (!ok) return res.status(401).json({ error: 'La clave actual no es correcta' });

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE settings SET admin_password_hash = ? WHERE id = 1').run(newHash);
  res.json({ ok: true });
});

module.exports = router;
