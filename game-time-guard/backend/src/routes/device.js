const express = require('express');
const db = require('../db');
const requireDevice = require('../middleware/requireDevice');
const { computeAllowance, localDateParts } = require('../timeLogic');

const router = express.Router();
router.use(requireDevice);

// Tope de minutos que se aceptan en un solo sync, para no confiar ciegamente
// en un agente con reloj desincronizado o manipulado. El agente sincroniza
// cada ~20-30s, asi que 10 minutos por sync es generoso.
const MAX_MINUTES_PER_SYNC = 10;

function buildConfigPayload(settings) {
  const games = db
    .prepare('SELECT process_name, display_name, path_contains FROM blocked_games ORDER BY display_name')
    .all();
  return {
    mode: settings.mode,
    dailyBudgetMinutes: settings.daily_budget_minutes,
    windowStart: settings.window_start,
    windowEnd: settings.window_end,
    timezone: settings.timezone,
    blockedGames: games.map((g) => ({
      processName: g.process_name,
      displayName: g.display_name,
      pathContains: g.path_contains,
    })),
  };
}

router.get('/config', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(buildConfigPayload(settings));
});

router.post('/sync', (req, res) => {
  const { hostname, agentVersion, runningBlockedProcessName, elapsedSecondsRunningSinceLastSync } = req.body || {};

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const { dateStr } = localDateParts(settings.timezone);

  let elapsedMinutes = Number(elapsedSecondsRunningSinceLastSync) / 60;
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) elapsedMinutes = 0;
  elapsedMinutes = Math.min(elapsedMinutes, MAX_MINUTES_PER_SYNC);

  if (elapsedMinutes > 0) {
    db.prepare(`
      INSERT INTO usage_daily (date, minutes_used, bonus_minutes) VALUES (?, ?, 0)
      ON CONFLICT(date) DO UPDATE SET minutes_used = minutes_used + excluded.minutes_used
    `).run(dateStr, elapsedMinutes);
  }

  const usage = db.prepare('SELECT * FROM usage_daily WHERE date = ?').get(dateStr) || {
    minutes_used: 0,
    bonus_minutes: 0,
  };
  const allowance = computeAllowance(settings, usage.minutes_used, usage.bonus_minutes);

  db.prepare(`
    UPDATE device_state SET
      last_seen_at = datetime('now'),
      agent_version = ?,
      hostname = ?,
      currently_running_game = ?,
      currently_blocked = ?
    WHERE id = 1
  `).run(
    agentVersion || null,
    hostname || null,
    runningBlockedProcessName || null,
    allowance.allowed ? 0 : 1
  );

  res.json({
    serverTime: new Date().toISOString(),
    ...buildConfigPayload(settings),
    minutesUsedToday: Math.round(usage.minutes_used * 10) / 10,
    remainingBudgetMinutes: Math.round(allowance.remainingBudgetMinutes * 10) / 10,
    inWindow: allowance.inWindow,
    allowedRightNow: allowance.allowed,
  });
});

module.exports = router;
