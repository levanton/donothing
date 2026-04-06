import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import type { Reminder } from './types';

interface ReminderRow {
  id: string;
  hour: number;
  minute: number;
  weekdays: string;
  enabled: number;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    weekdays: JSON.parse(row.weekdays),
    enabled: row.enabled === 1,
  };
}

export function getAllReminders(): Reminder[] {
  const db = getDb();
  const rows = db.getAllSync<ReminderRow>(
    'SELECT id, hour, minute, weekdays, enabled FROM reminders ORDER BY hour, minute',
  );
  return rows.map(rowToReminder);
}

export function getReminderById(id: string): Reminder | null {
  const db = getDb();
  const row = db.getFirstSync<ReminderRow>(
    'SELECT id, hour, minute, weekdays, enabled FROM reminders WHERE id = ?',
    id,
  );
  return row ? rowToReminder(row) : null;
}

export function insertReminder(hour: number, minute: number, weekdays: number[]): Reminder {
  const db = getDb();
  const id = randomUUID();
  db.runSync(
    'INSERT INTO reminders (id, hour, minute, weekdays, enabled) VALUES (?, ?, ?, ?, 1)',
    id, hour, minute, JSON.stringify(weekdays),
  );
  return { id, hour, minute, weekdays, enabled: true };
}

export function updateReminder(id: string, hour: number, minute: number, weekdays: number[]): void {
  const db = getDb();
  db.runSync(
    `UPDATE reminders SET hour = ?, minute = ?, weekdays = ?, updated_at = datetime('now') WHERE id = ?`,
    hour, minute, JSON.stringify(weekdays), id,
  );
}

export function deleteReminder(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM reminders WHERE id = ?', id);
}

export function toggleReminder(id: string): boolean {
  const db = getDb();
  db.runSync(
    `UPDATE reminders SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?`,
    id,
  );
  const row = db.getFirstSync<{ enabled: number }>(
    'SELECT enabled FROM reminders WHERE id = ?', id,
  );
  return row?.enabled === 1;
}
