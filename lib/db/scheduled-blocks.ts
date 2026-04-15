import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import type { ScheduledBlock } from './types';

interface BlockRow {
  id: string;
  hour: number;
  minute: number;
  duration_minutes: number;
  weekdays: string;
  enabled: number;
  group_id: string | null;
}

function rowToBlock(row: BlockRow): ScheduledBlock {
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    durationMinutes: row.duration_minutes,
    weekdays: JSON.parse(row.weekdays),
    enabled: row.enabled === 1,
    groupId: row.group_id,
  };
}

const SELECT_COLS = 'id, hour, minute, duration_minutes, weekdays, enabled, group_id';

export function getAllScheduledBlocks(): ScheduledBlock[] {
  const db = getDb();
  const rows = db.getAllSync<BlockRow>(
    `SELECT ${SELECT_COLS} FROM scheduled_blocks ORDER BY hour, minute`,
  );
  return rows.map(rowToBlock);
}

export function getScheduledBlockById(id: string): ScheduledBlock | null {
  const db = getDb();
  const row = db.getFirstSync<BlockRow>(
    `SELECT ${SELECT_COLS} FROM scheduled_blocks WHERE id = ?`,
    id,
  );
  return row ? rowToBlock(row) : null;
}

export function insertScheduledBlock(
  hour: number, minute: number, durationMinutes: number, weekdays: number[],
  groupId: string | null,
): ScheduledBlock {
  const db = getDb();
  const id = randomUUID();
  db.runSync(
    'INSERT INTO scheduled_blocks (id, hour, minute, duration_minutes, weekdays, enabled, group_id) VALUES (?, ?, ?, ?, ?, 1, ?)',
    id, hour, minute, durationMinutes, JSON.stringify(weekdays), groupId,
  );
  return { id, hour, minute, durationMinutes, weekdays, enabled: true, groupId };
}

export function updateScheduledBlock(
  id: string, hour: number, minute: number, durationMinutes: number, weekdays: number[],
  groupId: string | null,
): void {
  const db = getDb();
  db.runSync(
    `UPDATE scheduled_blocks SET hour = ?, minute = ?, duration_minutes = ?, weekdays = ?, group_id = ?, updated_at = datetime('now') WHERE id = ?`,
    hour, minute, durationMinutes, JSON.stringify(weekdays), groupId, id,
  );
}

export function deleteScheduledBlock(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM scheduled_blocks WHERE id = ?', id);
}

export function toggleScheduledBlock(id: string): boolean {
  const db = getDb();
  db.runSync(
    `UPDATE scheduled_blocks SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?`,
    id,
  );
  const row = db.getFirstSync<{ enabled: number }>(
    'SELECT enabled FROM scheduled_blocks WHERE id = ?', id,
  );
  return row?.enabled === 1;
}
