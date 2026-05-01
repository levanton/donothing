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

function rowToBlock(row: BlockRow): ScheduledBlock {
  // Run the row through the same schema we use on writes. Catches any
  // legacy row that pre-dates the validation layer (e.g. weekdays
  // stored as `[]` from before the normalize-on-write change).
  const parsed = ScheduledBlockInputSchema.parse({
    hour: row.hour,
    minute: row.minute,
    durationMinutes: row.duration_minutes,
    weekdays: JSON.parse(row.weekdays),
    unlockGoalMinutes: row.unlock_goal_minutes,
  });
  return {
    id: row.id,
    hour: parsed.hour,
    minute: parsed.minute,
    durationMinutes: parsed.durationMinutes,
    weekdays: parsed.weekdays,
    enabled: row.enabled === 1,
    unlockGoalMinutes: parsed.unlockGoalMinutes,
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
  db.runSync(
    `UPDATE scheduled_blocks SET hour = ?, minute = ?, duration_minutes = ?, weekdays = ?, unlock_goal_minutes = ?, updated_at = datetime('now') WHERE id = ?`,
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
