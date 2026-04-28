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
  unlock_goal_minutes: number;
}

function rowToBlock(row: BlockRow): ScheduledBlock {
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    durationMinutes: row.duration_minutes,
    weekdays: JSON.parse(row.weekdays),
    enabled: row.enabled === 1,
    unlockGoalMinutes: row.unlock_goal_minutes,
  };
}

const SELECT_COLS =
  'id, hour, minute, duration_minutes, weekdays, enabled, unlock_goal_minutes';

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
  hour: number,
  minute: number,
  durationMinutes: number,
  weekdays: number[],
  unlockGoalMinutes: number,
): ScheduledBlock {
  const db = getDb();
  const id = randomUUID();
  const goal = unlockGoalMinutes ?? 5;
  db.runSync(
    'INSERT INTO scheduled_blocks (id, hour, minute, duration_minutes, weekdays, enabled, unlock_goal_minutes) VALUES (?, ?, ?, ?, ?, 1, ?)',
    id,
    hour,
    minute,
    durationMinutes,
    JSON.stringify(weekdays),
    goal,
  );
  return { id, hour, minute, durationMinutes, weekdays, enabled: true, unlockGoalMinutes: goal };
}

export function updateScheduledBlock(
  id: string,
  hour: number,
  minute: number,
  durationMinutes: number,
  weekdays: number[],
  unlockGoalMinutes: number,
): void {
  const db = getDb();
  const goal = unlockGoalMinutes ?? 5;
  db.runSync(
    `UPDATE scheduled_blocks SET hour = ?, minute = ?, duration_minutes = ?, weekdays = ?, unlock_goal_minutes = ?, updated_at = datetime('now') WHERE id = ?`,
    hour,
    minute,
    durationMinutes,
    JSON.stringify(weekdays),
    goal,
    id,
  );
}

export function deleteScheduledBlock(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM scheduled_blocks WHERE id = ?', id);
}

export function toggleScheduledBlock(id: string): boolean {
  const db = getDb();
  // RETURNING avoids a second SELECT round-trip and removes the
  // read-after-write race the old code had (an interleaved write
  // could change enabled between the UPDATE and the SELECT).
  const row = db.getFirstSync<{ enabled: number }>(
    `UPDATE scheduled_blocks
       SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
     WHERE id = ?
     RETURNING enabled`,
    id,
  );
  return row?.enabled === 1;
}
