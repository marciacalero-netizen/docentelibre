const crypto = require('crypto');
const { settingsRef } = require('../firestore');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function requireDevice(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) return res.status(401).json({ error: 'Falta token de dispositivo' });

  try {
    const snap = await settingsRef.get();
    const settings = snap.data();
    if (!timingSafeEqual(token, settings.deviceToken)) {
      return res.status(401).json({ error: 'Token de dispositivo invalido' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireDevice;
