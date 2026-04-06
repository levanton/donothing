import { getDb } from './index';

// --- Syncable settings (will go to Supabase) ---

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ? AND user_id = 'local'",
    key,
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO settings (key, user_id, value, updated_at)
     VALUES (?, 'local', ?, datetime('now'))
     ON CONFLICT(key, user_id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key, value,
  );
}

// --- Device-local state (never synced) ---

export function getDeviceState(key: string): string | null {
  const db = getDb();
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM device_state WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export function setDeviceState(key: string, value: string): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO device_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key, value,
  );
}

export function deleteDeviceState(key: string): void {
  const db = getDb();
  db.runSync('DELETE FROM device_state WHERE key = ?', key);
}
