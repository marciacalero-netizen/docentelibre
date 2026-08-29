const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { computeAllowance, localDateParts } = require('../timeLogic');

const router = express.Router();
router.use(requireAuth);

const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // si no hay heartbeat en 3 min, se considera desconectado

router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const { dateStr } = localDateParts(settings.timezone);

  let usage = db.prepare('SELECT * FROM usage_daily WHERE date = ?').get(dateStr);
  if (!usage) usage = { date: dateStr, minutes_used: 0, bonus_minutes: 0 };

  const allowance = computeAllowance(settings, usage.minutes_used, usage.bonus_minutes);
  const deviceState = db.prepare('SELECT * FROM device_state WHERE id = 1').get();

  const online = !!(deviceState.last_seen_at && Date.now() - new Date(deviceState.last_seen_at + 'Z').getTime() < OFFLINE_THRESHOLD_MS);

  res.json({
    date: dateStr,
    mode: settings.mode,
    dailyBudgetMinutes: settings.daily_budget_minutes,
    bonusMinutes: usage.bonus_minutes,
    minutesUsedToday: Math.round(usage.minutes_used * 10) / 10,
    remainingBudgetMinutes: Math.round(allowance.remainingBudgetMinutes * 10) / 10,
    windowStart: settings.window_start,
    windowEnd: settings.window_end,
    inWindow: allowance.inWindow,
    allowedRightNow: allowance.allowed,
    device: {
      online,
      lastSeenAt: deviceState.last_seen_at,
      agentVersion: deviceState.agent_version,
      hostname: deviceState.hostname,
      currentlyRunningGame: deviceState.currently_running_game,
      currentlyBlocked: !!deviceState.currently_blocked,
    },
  });
});

router.post('/adjust', (req, res) => {
  const { deltaMinutes } = req.body || {};
  const delta = Number(deltaMinutes);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'deltaMinutes invalido' });

  const settings = db.prepare('SELECT timezone FROM settings WHERE id = 1').get();
  const { dateStr } = localDateParts(settings.timezone);

  db.prepare(`
    INSERT INTO usage_daily (date, minutes_used, bonus_minutes) VALUES (?, 0, ?)
    ON CONFLICT(date) DO UPDATE SET bonus_minutes = bonus_minutes + excluded.bonus_minutes
  `).run(dateStr, delta);

  res.json({ ok: true });
});

router.post('/reset-today', (req, res) => {
  const settings = db.prepare('SELECT timezone FROM settings WHERE id = 1').get();
  const { dateStr } = localDateParts(settings.timezone);
  db.prepare(`
    INSERT INTO usage_daily (date, minutes_used, bonus_minutes) VALUES (?, 0, 0)
    ON CONFLICT(date) DO UPDATE SET minutes_used = 0, bonus_minutes = 0
  `).run(dateStr);
  res.json({ ok: true });
});

module.exports = router;
