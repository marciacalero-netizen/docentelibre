const crypto = require('crypto');
const db = require('../db');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireDevice(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) return res.status(401).json({ error: 'Falta token de dispositivo' });

  const settings = db.prepare('SELECT device_token FROM settings WHERE id = 1').get();
  if (!timingSafeEqual(token, settings.device_token)) {
    return res.status(401).json({ error: 'Token de dispositivo invalido' });
  }
  next();
}

module.exports = requireDevice;
