import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import type { CheckinRow } from './types';

export function getCheckinByWeek(weekKey: string): CheckinRow | null {
  const db = getDb();
  return db.getFirstSync<CheckinRow>(
    "SELECT * FROM weekly_checkins WHERE week_key = ? AND (user_id IS NULL OR user_id = 'local') ORDER BY timestamp DESC LIMIT 1",
    weekKey,
  );
}

export function getPreviousCheckin(currentWeekKey: string): CheckinRow | null {
  const db = getDb();
  return db.getFirstSync<CheckinRow>(
    'SELECT * FROM weekly_checkins WHERE week_key < ? ORDER BY week_key DESC LIMIT 1',
    currentWeekKey,
  );
}

export function getLatestCheckin(): CheckinRow | null {
  const db = getDb();
  return db.getFirstSync<CheckinRow>(
    'SELECT * FROM weekly_checkins ORDER BY timestamp DESC LIMIT 1',
  );
}

export function insertCheckin(
  weekKey: string,
  sleep: number,
  anxiety: number,
  focus: number,
  energy: number,
): void {
  const db = getDb();
  const id = randomUUID();
  const timestamp = Date.now();
  db.runSync(
    'INSERT OR REPLACE INTO weekly_checkins (id, user_id, timestamp, week_key, sleep, anxiety, focus, energy) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)',
    id,
    timestamp,
    weekKey,
    sleep,
    anxiety,
    focus,
    energy,
  );
}
