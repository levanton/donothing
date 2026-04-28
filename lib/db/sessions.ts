import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import type { Session } from './types';

function generateId(): string {
  return randomUUID();
}

interface SessionRow {
  id: string;
  timestamp: number;
  duration: number;
  mood: string | null;
}

const SESSION_COLS = 'id, timestamp, duration, mood';

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    timestamp: row.timestamp,
    duration: row.duration,
    mood: row.mood ?? undefined,
  };
}

// Sanity cap — no single session can plausibly last longer than 24 hours.
// This also protects against timestamp-sized values leaking in via bad state
// (e.g. sessionStartTime not being set before a save).
const MAX_SESSION_DURATION = 24 * 60 * 60;

export function addSession(duration: number): Session | null {
  if (duration < 1) return null;
  if (duration > MAX_SESSION_DURATION) return null;
  const db = getDb();
  const id = generateId();
  const timestamp = Date.now();
  db.runSync(
    'INSERT INTO sessions (id, timestamp, duration) VALUES (?, ?, ?)',
    id, timestamp, duration,
  );
  return { id, timestamp, duration };
}

/** Delete any rows with absurd durations (e.g. timestamp-sized values). */
export function cleanupInvalidSessions(): number {
  const db = getDb();
  const result = db.runSync(
    'DELETE FROM sessions WHERE duration > ? OR duration < 1',
    MAX_SESSION_DURATION,
  );
  return result.changes;
}

export function getAllSessions(): Session[] {
  const db = getDb();
  const rows = db.getAllSync<SessionRow>(
    `SELECT ${SESSION_COLS} FROM sessions ORDER BY timestamp DESC`,
  );
  return rows.map(rowToSession);
}

export function getSessionsByDateRange(startMs: number, endMs: number): Session[] {
  const db = getDb();
  const rows = db.getAllSync<SessionRow>(
    `SELECT ${SESSION_COLS} FROM sessions WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC`,
    startMs, endMs,
  );
  return rows.map(rowToSession);
}

export function deleteSessionById(id: string): void {
  const db = getDb();
  db.runSync('DELETE FROM sessions WHERE id = ?', id);
}

export function deleteSessionsByDateKey(dateKey: string): void {
  const db = getDb();
  // Match the read-path's date_key derivation (strftime + localtime) so
  // DST days delete the right rows. The previous JS-side
  // `startOfDay + 86400000` math is wrong on 23/25-hour days.
  db.runSync(
    `DELETE FROM sessions WHERE strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') = ?`,
    dateKey,
  );
}

export function getTodayDuration(): number {
  const db = getDb();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const row = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration), 0) as total FROM sessions WHERE timestamp >= ?',
    startOfDay,
  );
  return row?.total ?? 0;
}

export function getWeekDurations(startMs: number, endMs: number): Map<string, number> {
  const db = getDb();
  const rows = db.getAllSync<{ date_key: string; total: number }>(
    `SELECT
      strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as date_key,
      SUM(duration) as total
    FROM sessions
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY date_key`,
    startMs, endMs,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.date_key, r.total);
  }
  return map;
}

export function getDurationSince(sinceMs: number): number {
  const db = getDb();
  const row = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration), 0) as total FROM sessions WHERE timestamp >= ?',
    sinceMs,
  );
  return row?.total ?? 0;
}

export function getDistinctDatesDesc(limit: number): string[] {
  const db = getDb();
  const rows = db.getAllSync<{ date_key: string }>(
    `SELECT DISTINCT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as date_key
     FROM sessions
     ORDER BY date_key DESC
     LIMIT ?`,
    limit,
  );
  return rows.map(r => r.date_key);
}

export function getDailyDurations(days: number): Map<string, number> {
  const db = getDb();
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  const rows = db.getAllSync<{ date_key: string; total: number }>(
    `SELECT
      strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as date_key,
      SUM(duration) as total
    FROM sessions
    WHERE timestamp >= ?
    GROUP BY date_key
    ORDER BY date_key DESC`,
    startMs,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.date_key, r.total);
  }
  return map;
}

export function getMonthDurations(year: number, month: number): Map<string, number> {
  const startMs = new Date(year, month - 1, 1).getTime();
  const endMs = new Date(year, month, 1).getTime();
  return getWeekDurations(startMs, endMs);
}

export function getSessionCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM sessions');
  return row?.count ?? 0;
}

export function getLongestSessionDuration(): number {
  const db = getDb();
  const row = db.getFirstSync<{ max_dur: number }>('SELECT COALESCE(MAX(duration), 0) as max_dur FROM sessions');
  return row?.max_dur ?? 0;
}

export function getActiveDaysCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(DISTINCT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime')) as count FROM sessions`,
  );
  return row?.count ?? 0;
}

export function updateSessionMood(sessionId: string, mood: string): void {
  const db = getDb();
  db.runSync('UPDATE sessions SET mood = ? WHERE id = ?', mood, sessionId);
}

export function getTotalDuration(): number {
  const db = getDb();
  const row = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration), 0) as total FROM sessions',
  );
  return row?.total ?? 0;
}

export function getBestDayDuration(): number {
  const db = getDb();
  const row = db.getFirstSync<{ best: number }>(
    `SELECT COALESCE(MAX(total), 0) as best FROM (
      SELECT SUM(duration) as total
      FROM sessions
      GROUP BY strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime')
    )`,
  );
  return row?.best ?? 0;
}
