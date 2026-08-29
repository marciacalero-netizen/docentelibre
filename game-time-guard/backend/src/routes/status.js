const express = require('express');
const { settingsRef, usageCollection, deviceStateRef, FieldValue } = require('../firestore');
const requireAuth = require('../middleware/requireAuth');
const { computeAllowance, localDateParts } = require('../timeLogic');
const ah = require('../asyncHandler');

const router = express.Router();
router.use(requireAuth);

const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // si no hay heartbeat en 3 min, se considera desconectado

router.get('/', ah(async (req, res) => {
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.data();
  const { dateStr } = localDateParts(settings.timezone);

  const usageSnap = await usageCollection.doc(dateStr).get();
  const usage = usageSnap.exists ? usageSnap.data() : { minutesUsed: 0, bonusMinutes: 0 };

  const allowance = computeAllowance(settings, usage.minutesUsed, usage.bonusMinutes);

  const deviceSnap = await deviceStateRef.get();
  const deviceState = deviceSnap.exists ? deviceSnap.data() : {};

  const lastSeenMs = deviceState.lastSeenAt ? new Date(deviceState.lastSeenAt).getTime() : 0;
  const online = !!(deviceState.lastSeenAt && Date.now() - lastSeenMs < OFFLINE_THRESHOLD_MS);

  res.json({
    date: dateStr,
    mode: settings.mode,
    dailyBudgetMinutes: settings.dailyBudgetMinutes,
    bonusMinutes: usage.bonusMinutes || 0,
    minutesUsedToday: Math.round((usage.minutesUsed || 0) * 10) / 10,
    remainingBudgetMinutes: Math.round(allowance.remainingBudgetMinutes * 10) / 10,
    windowStart: settings.windowStart,
    windowEnd: settings.windowEnd,
    inWindow: allowance.inWindow,
    allowedRightNow: allowance.allowed,
    device: {
      online,
      lastSeenAt: deviceState.lastSeenAt || null,
      agentVersion: deviceState.agentVersion || null,
      hostname: deviceState.hostname || null,
      currentlyRunningGame: deviceState.currentlyRunningGame || null,
      currentlyBlocked: !!deviceState.currentlyBlocked,
    },
  });
}));

router.post('/adjust', ah(async (req, res) => {
  const { deltaMinutes } = req.body || {};
  const delta = Number(deltaMinutes);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'deltaMinutes invalido' });

  const settingsSnap = await settingsRef.get();
  const { dateStr } = localDateParts(settingsSnap.data().timezone);

  await usageCollection.doc(dateStr).set({ bonusMinutes: FieldValue.increment(delta) }, { merge: true });
  res.json({ ok: true });
}));

router.post('/reset-today', ah(async (req, res) => {
  const settingsSnap = await settingsRef.get();
  const { dateStr } = localDateParts(settingsSnap.data().timezone);
  await usageCollection.doc(dateStr).set({ minutesUsed: 0, bonusMinutes: 0 });
  res.json({ ok: true });
}));

module.exports = router;
