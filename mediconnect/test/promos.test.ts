import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, one, run } from '../src/db.ts';

test('promos-cli: carga las promociones y agrega Podología sin duplicar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'promos-'));
  const db = openDb(join(dir, 'b.db'));
  run(db, `INSERT INTO clinics (name, slug, timezone, settings, created_at) VALUES ('Centro ProSalud','prosalud','America/Guayaquil','{"assistant_name":"Gia"}','2026-01-01T00:00:00Z')`);
  run(db, `INSERT INTO specialties (clinic_id, name, kind, sort_order) VALUES (1,'Pediatría','appointment',3)`);
  db.close();
  const cli = () => execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/promos-cli.ts', `--db=${join(dir, 'b.db')}`], { encoding: 'utf8' });
  const out = cli();
  assert.match(out, /9 promociones/);
  assert.match(out, /Podología/);
  cli();
  const db2 = openDb(join(dir, 'b.db'));
  const s = JSON.parse(one<any>(db2, 'SELECT settings FROM clinics').settings);
  assert.equal(s.assistant_name, 'Gia');
  assert.match(s.promotions, /Podología\* — valoración gratuita/);
  assert.equal(one<any>(db2, `SELECT COUNT(*) n FROM specialties WHERE name = 'Podología'`).n, 1);
  assert.equal(one<any>(db2, `SELECT kind FROM specialties WHERE name = 'Podología'`).kind, 'handoff');
  assert.equal(one<any>(db2, `SELECT COUNT(*) n FROM specialties WHERE name = 'Pediatría'`).n, 1);
});
