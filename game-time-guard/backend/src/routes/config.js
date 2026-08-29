const express = require('express');
const crypto = require('crypto');
const { settingsRef, gamesCollection } = require('../firestore');
const requireAuth = require('../middleware/requireAuth');
const ah = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);

const VALID_MODES = new Set(['budget', 'window', 'both']);
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/', ah(async (req, res) => {
  const snap = await settingsRef.get();
  const settings = snap.data();
  const gamesSnap = await gamesCollection.orderBy('displayName').get();
  const games = gamesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  res.json({
    settings: {
      mode: settings.mode,
      dailyBudgetMinutes: settings.dailyBudgetMinutes,
      windowStart: settings.windowStart,
      windowEnd: settings.windowEnd,
      timezone: settings.timezone,
      deviceToken: settings.deviceToken,
    },
    games,
  });
}));

router.put('/', ah(async (req, res) => {
  const { mode, dailyBudgetMinutes, windowStart, windowEnd, timezone } = req.body || {};

  const snap = await settingsRef.get();
  const current = snap.data();
  const next = {
    mode: mode !== undefined ? mode : current.mode,
    dailyBudgetMinutes: dailyBudgetMinutes !== undefined ? Number(dailyBudgetMinutes) : current.dailyBudgetMinutes,
    windowStart: windowStart !== undefined ? windowStart : current.windowStart,
    windowEnd: windowEnd !== undefined ? windowEnd : current.windowEnd,
    timezone: timezone !== undefined ? timezone : current.timezone,
  };

  if (!VALID_MODES.has(next.mode)) return res.status(400).json({ error: 'Modo invalido' });
  if (!Number.isFinite(next.dailyBudgetMinutes) || next.dailyBudgetMinutes < 0 || next.dailyBudgetMinutes > 24 * 60) {
    return res.status(400).json({ error: 'Minutos de bolsa invalidos' });
  }
  if (!HHMM_RE.test(next.windowStart) || !HHMM_RE.test(next.windowEnd)) {
    return res.status(400).json({ error: 'Formato de horario invalido (usa HH:MM)' });
  }

  await settingsRef.update(next);
  res.json({ ok: true });
}));

router.post('/games', ah(async (req, res) => {
  const { processName, displayName, pathContains } = req.body || {};
  if (!processName || !displayName) {
    return res.status(400).json({ error: 'Faltan processName o displayName' });
  }
  const normalizedProcess = String(processName).trim();
  if (!/\.exe$/i.test(normalizedProcess)) {
    return res.status(400).json({ error: 'processName debe terminar en .exe (ej: RobloxPlayerBeta.exe)' });
  }

  const docRef = await gamesCollection.add({
    processName: normalizedProcess,
    displayName: String(displayName).trim(),
    pathContains: pathContains ? String(pathContains).trim() : null,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ id: docRef.id });
}));

router.delete('/games/:id', ah(async (req, res) => {
  await gamesCollection.doc(req.params.id).delete();
  res.json({ ok: true });
}));

router.post('/device-token/regenerate', ah(async (req, res) => {
  const newToken = crypto.randomBytes(24).toString('hex');
  await settingsRef.update({ deviceToken: newToken });
  res.json({ deviceToken: newToken });
}));

module.exports = router;
