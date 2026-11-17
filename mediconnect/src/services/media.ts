// Archivos que envían los pacientes (fotos, documentos, notas de voz) y los que recepción envía desde el panel.
// Se guardan en disco, fuera de la carpeta pública, con nombre aleatorio y permisos solo del servicio; el panel los
// muestra únicamente a usuarios con sesión de la misma clínica. Se borran solos a los RETENTION_DAYS días.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { nowIso } from '../util.ts';

export const RETENTION_DAYS = 90;
export const MAX_IN_BYTES = 16 * 1024 * 1024;     // lo que se descarga de un paciente
export const MAX_OUT_BYTES = 8 * 1024 * 1024;     // lo que recepción puede enviar

let dir = 'data/media';
/** Carpeta donde se guardan los archivos (el servidor la fija junto a la base de datos). */
export const setMediaDir = (d: string): void => { dir = d; };

// Solo se guardan y se muestran estos tipos; cualquier otro se descarta.
const TYPES: Record<string, { ext: string; inline: boolean }> = {
  'image/jpeg': { ext: 'jpg', inline: true }, 'image/png': { ext: 'png', inline: true }, 'image/webp': { ext: 'webp', inline: true },
  'application/pdf': { ext: 'pdf', inline: true },
  'audio/ogg': { ext: 'ogg', inline: true }, 'audio/mpeg': { ext: 'mp3', inline: true }, 'audio/mp4': { ext: 'm4a', inline: true }, 'audio/aac': { ext: 'aac', inline: true }, 'audio/amr': { ext: 'amr', inline: false },
  'application/msword': { ext: 'doc', inline: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', inline: false },
  'application/vnd.ms-excel': { ext: 'xls', inline: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', inline: false },
  'text/plain': { ext: 'txt', inline: false },
};
export const baseMime = (m: string): string => String(m || '').split(';')[0].trim().toLowerCase();
export const allowedMime = (m: string): boolean => baseMime(m) in TYPES;

/** Comprueba por el contenido que una foto o PDF que envía recepción es lo que dice ser. */
export function sniff(data: Buffer): string | null {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length > 5 && data.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

const cleanName = (n: string | undefined, ext: string): string => {
  const base = String(n || '').replace(/[^\p{L}\p{N} ._()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  return base || `archivo.${ext}`;
};

/** Guarda un archivo asociado a un mensaje. Devuelve el id o null si el tipo no está permitido. */
export function saveMedia(db: DB, clinicId: number, messageId: number, data: Buffer, mime: string, filename?: string): number | null {
  const m = baseMime(mime), t = TYPES[m];
  if (!t) return null;
  const folder = join(dir, String(clinicId));
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const file = `${randomBytes(16).toString('hex')}.${t.ext}`;
  writeFileSync(join(folder, file), data, { mode: 0o600 });
  return Number(run(db, 'INSERT INTO media (clinic_id, message_id, mime, filename, size, file, created_at) VALUES (?,?,?,?,?,?,?)',
    clinicId, messageId, m, cleanName(filename, t.ext), data.length, file, nowIso()).lastInsertRowid);
}

/** Archivo para mostrar en el panel (solo de la clínica de la sesión). */
export function readMedia(db: DB, clinicId: number, id: number): { data: Buffer; mime: string; filename: string; inline: boolean } | null {
  const r = one<any>(db, 'SELECT mime, filename, file FROM media WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL', clinicId, id);
  if (!r || !/^[0-9a-f]{32}\.[a-z0-9]{2,5}$/.test(r.file)) return null;
  try { return { data: readFileSync(join(dir, String(clinicId), r.file)), mime: r.mime, filename: r.filename, inline: TYPES[r.mime]?.inline ?? false }; }
  catch { return null; }
}

const removeFiles = (db: DB, rows: { id: number; clinic_id: number; file: string }[]): number => {
  for (const r of rows) {
    if (/^[0-9a-f]{32}\.[a-z0-9]{2,5}$/.test(r.file)) rmSync(join(dir, String(r.clinic_id), r.file), { force: true });
    run(db, 'UPDATE media SET deleted_at = ? WHERE id = ?', nowIso(), r.id);
  }
  return rows.length;
};

/** Borra los archivos con más de RETENTION_DAYS días. */
export const purgeOldMedia = (db: DB, now = Date.now()): number =>
  removeFiles(db, all(db, 'SELECT id, clinic_id, file FROM media WHERE deleted_at IS NULL AND created_at < ?', nowIso(new Date(now - RETENTION_DAYS * 86400000))));

/** Borra los archivos de una conversación (derecho de supresión) o de toda la clínica (borrar pruebas). */
export const purgeConversationMedia = (db: DB, clinicId: number, conversationId: number): number =>
  removeFiles(db, all(db, 'SELECT m.id, m.clinic_id, m.file FROM media m JOIN messages g ON g.id = m.message_id AND g.clinic_id = m.clinic_id WHERE m.clinic_id = ? AND g.conversation_id = ? AND m.deleted_at IS NULL', clinicId, conversationId));
export const purgeClinicMedia = (db: DB, clinicId: number): number =>
  removeFiles(db, all(db, 'SELECT id, clinic_id, file FROM media WHERE clinic_id = ? AND deleted_at IS NULL', clinicId));
