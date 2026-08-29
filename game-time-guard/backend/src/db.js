const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'game-time-guard.sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    admin_password_hash TEXT NOT NULL,
    jwt_secret TEXT NOT NULL,
    device_token TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'budget',       -- 'budget' | 'window' | 'both'
    daily_budget_minutes INTEGER NOT NULL DEFAULT 180,
    window_start TEXT NOT NULL DEFAULT '16:00',
    window_end TEXT NOT NULL DEFAULT '19:00',
    timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'
  );

  CREATE TABLE IF NOT EXISTS blocked_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_name TEXT NOT NULL,      -- ej: RobloxPlayerBeta.exe
    display_name TEXT NOT NULL,      -- ej: Roblox
    path_contains TEXT,              -- opcional, filtro extra por ruta
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_daily (
    date TEXT PRIMARY KEY,           -- YYYY-MM-DD (hora local del dispositivo)
    minutes_used REAL NOT NULL DEFAULT 0,
    bonus_minutes REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS device_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_seen_at TEXT,
    agent_version TEXT,
    currently_running_game TEXT,
    currently_blocked INTEGER NOT NULL DEFAULT 0,
    hostname TEXT
  );
`);

function seedIfEmpty() {
  const existing = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (existing) return;

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(6).toString('hex');
  const passwordHash = bcrypt.hashSync(initialPassword, 10);
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const deviceToken = crypto.randomBytes(24).toString('hex');

  db.prepare(`
    INSERT INTO settings (id, admin_password_hash, jwt_secret, device_token)
    VALUES (1, ?, ?, ?)
  `).run(passwordHash, jwtSecret, deviceToken);

  db.prepare(`INSERT INTO device_state (id, currently_blocked) VALUES (1, 0)`).run();

  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log('========================================================');
    console.log('  Clave de adulto generada automaticamente (primer uso):');
    console.log('  ' + initialPassword);
    console.log('  Guardala ahora. Se puede cambiar despues desde el panel.');
    console.log('========================================================');
  }
  console.log('Token de dispositivo (para configurar el agente de Windows):');
  console.log('  ' + deviceToken);
}

seedIfEmpty();

module.exports = db;
