const express = require('express');
const { settingsRef, usageCollection, deviceStateRef, gamesCollection, FieldValue } = require('../firestore');
const requireDevice = require('../middleware/requireDevice');
const { computeAllowance, localDateParts } = require('../timeLogic');
const ah = require('../asyncHandler');

const router = express.Router();
router.use(requireDevice);

// Tope de minutos que se aceptan en un solo sync, para no confiar ciegamente
// en un agente con reloj desincronizado o manipulado. El agente sincroniza
// cada ~20-30s, asi que 10 minutos por sync es generoso.
const MAX_MINUTES_PER_SYNC = 10;

async function buildConfigPayload(settings) {
  const gamesSnap = await gamesCollection.orderBy('displayName').get();
  const games = gamesSnap.docs.map((d) => d.data());
  return {
    mode: settings.mode,
    dailyBudgetMinutes: settings.dailyBudgetMinutes,
    windowStart: settings.windowStart,
    windowEnd: settings.windowEnd,
    timezone: settings.timezone,
    blockedGames: games.map((g) => ({
      processName: g.processName,
      displayName: g.displayName,
      pathContains: g.pathContains,
    })),
  };
}

router.get('/config', ah(async (req, res) => {
  const settingsSnap = await settingsRef.get();
  res.json(await buildConfigPayload(settingsSnap.data()));
}));

router.post('/sync', ah(async (req, res) => {
  const { hostname, agentVersion, runningBlockedProcessName, elapsedSecondsRunningSinceLastSync } = req.body || {};

  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.data();
  const { dateStr } = localDateParts(settings.timezone);

  let elapsedMinutes = Number(elapsedSecondsRunningSinceLastSync) / 60;
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) elapsedMinutes = 0;
  elapsedMinutes = Math.min(elapsedMinutes, MAX_MINUTES_PER_SYNC);

  const usageRef = usageCollection.doc(dateStr);
  if (elapsedMinutes > 0) {
    await usageRef.set({ minutesUsed: FieldValue.increment(elapsedMinutes) }, { merge: true });
  }

  const usageSnap = await usageRef.get();
  const usage = usageSnap.exists ? usageSnap.data() : { minutesUsed: 0, bonusMinutes: 0 };
  const allowance = computeAllowance(settings, usage.minutesUsed, usage.bonusMinutes);

  await deviceStateRef.set({
    lastSeenAt: new Date().toISOString(),
    agentVersion: agentVersion || null,
    hostname: hostname || null,
    currentlyRunningGame: runningBlockedProcessName || null,
    currentlyBlocked: !allowance.allowed,
  }, { merge: true });

  res.json({
    serverTime: new Date().toISOString(),
    ...(await buildConfigPayload(settings)),
    minutesUsedToday: Math.round((usage.minutesUsed || 0) * 10) / 10,
    remainingBudgetMinutes: Math.round(allowance.remainingBudgetMinutes * 10) / 10,
    inWindow: allowance.inWindow,
    allowedRightNow: allowance.allowed,
  });
}));

module.exports = router;
