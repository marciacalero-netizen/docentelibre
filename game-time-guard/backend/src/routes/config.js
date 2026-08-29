const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

const VALID_MODES = new Set(['budget', 'window', 'both']);
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/', (req, res) => {
  const settings = db
    .prepare('SELECT mode, daily_budget_minutes, window_start, window_end, timezone, device_token FROM settings WHERE id = 1')
    .get();
  const games = db.prepare('SELECT id, process_name, display_name, path_contains FROM blocked_games ORDER BY display_name').all();
  res.json({ settings, games });
});

router.put('/', (req, res) => {
  const { mode, dailyBudgetMinutes, windowStart, windowEnd, timezone } = req.body || {};

  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const next = {
    mode: mode !== undefined ? mode : current.mode,
    daily_budget_minutes: dailyBudgetMinutes !== undefined ? Number(dailyBudgetMinutes) : current.daily_budget_minutes,
    window_start: windowStart !== undefined ? windowStart : current.window_start,
    window_end: windowEnd !== undefined ? windowEnd : current.window_end,
    timezone: timezone !== undefined ? timezone : current.timezone,
  };

  if (!VALID_MODES.has(next.mode)) return res.status(400).json({ error: 'Modo invalido' });
  if (!Number.isFinite(next.daily_budget_minutes) || next.daily_budget_minutes < 0 || next.daily_budget_minutes > 24 * 60) {
    return res.status(400).json({ error: 'Minutos de bolsa invalidos' });
  }
  if (!HHMM_RE.test(next.window_start) || !HHMM_RE.test(next.window_end)) {
    return res.status(400).json({ error: 'Formato de horario invalido (usa HH:MM)' });
  }

  db.prepare(`
    UPDATE settings SET mode = ?, daily_budget_minutes = ?, window_start = ?, window_end = ?, timezone = ?
    WHERE id = 1
  `).run(next.mode, next.daily_budget_minutes, next.window_start, next.window_end, next.timezone);

  res.json({ ok: true });
});

router.post('/games', (req, res) => {
  const { processName, displayName, pathContains } = req.body || {};
  if (!processName || !displayName) {
    return res.status(400).json({ error: 'Faltan processName o displayName' });
  }
  const normalizedProcess = String(processName).trim();
  if (!/\.exe$/i.test(normalizedProcess)) {
    return res.status(400).json({ error: 'processName debe terminar en .exe (ej: RobloxPlayerBeta.exe)' });
  }

  const info = db
    .prepare('INSERT INTO blocked_games (process_name, display_name, path_contains) VALUES (?, ?, ?)')
    .run(normalizedProcess, String(displayName).trim(), pathContains ? String(pathContains).trim() : null);

  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete('/games/:id', (req, res) => {
  db.prepare('DELETE FROM blocked_games WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/device-token/regenerate', (req, res) => {
  const crypto = require('crypto');
  const newToken = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE settings SET device_token = ? WHERE id = 1').run(newToken);
  res.json({ deviceToken: newToken });
});

module.exports = router;
