import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import { ScheduledBlockInputSchema } from './schemas';
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

function parseWeekdays(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is number => typeof d === 'number') : [];
  } catch {
    return [];
  }
}

function rowToBlock(row: BlockRow): ScheduledBlock {
  // "Normalize at write, trust at read" — every writer (insert/update)
  // routes through ScheduledBlockInputSchema, so by the time a row hits
  // SQLite it's already canonical. Read-path stays a plain mapper.
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    durationMinutes: row.duration_minutes,
    weekdays: parseWeekdays(row.weekdays),
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
  const valid = ScheduledBlockInputSchema.parse({
    hour, minute, durationMinutes, weekdays, unlockGoalMinutes,
  });
  const db = getDb();
  const id = randomUUID();
  db.runSync(
    'INSERT INTO scheduled_blocks (id, hour, minute, duration_minutes, weekdays, enabled, unlock_goal_minutes) VALUES (?, ?, ?, ?, ?, 1, ?)',
    id,
    valid.hour,
    valid.minute,
    valid.durationMinutes,
    JSON.stringify(valid.weekdays),
    valid.unlockGoalMinutes,
  );
  return {
    id,
    hour: valid.hour,
    minute: valid.minute,
    durationMinutes: valid.durationMinutes,
    weekdays: valid.weekdays,
    enabled: true,
    unlockGoalMinutes: valid.unlockGoalMinutes,
  };
}

export function updateScheduledBlock(
  id: string,
  hour: number,
  minute: number,
  durationMinutes: number,
  weekdays: number[],
  unlockGoalMinutes: number,
): void {
  const valid = ScheduledBlockInputSchema.parse({
    hour, minute, durationMinutes, weekdays, unlockGoalMinutes,
  });
  const db = getDb();
  // updated_at is refreshed by the AFTER UPDATE trigger from migration009.
  db.runSync(
    `UPDATE scheduled_blocks SET hour = ?, minute = ?, duration_minutes = ?, weekdays = ?, unlock_goal_minutes = ? WHERE id = ?`,
    valid.hour,
    valid.minute,
    valid.durationMinutes,
    JSON.stringify(valid.weekdays),
    valid.unlockGoalMinutes,
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
  // updated_at is refreshed by the AFTER UPDATE trigger from migration009.
  const row = db.getFirstSync<{ enabled: number }>(
    `UPDATE scheduled_blocks
       SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END
     WHERE id = ?
     RETURNING enabled`,
    id,
  );
  return row?.enabled === 1;
}
