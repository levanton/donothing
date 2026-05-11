import type { SQLiteDatabase } from 'expo-sqlite';
import type { Migration } from '../migrations';

/**
 * Schema hygiene + Supabase-ready columns.
 *
 * - user_id: NOT NULL DEFAULT 'local' on every row-bearing table so RLS
 *   has something to filter by once we sync.
 * - CHECK constraints on time/duration/boolean columns to reject corrupt
 *   writes at the DB level instead of trusting JS validation.
 * - deleted_at + version columns added everywhere we plan to sync, so
 *   conflict resolution has the bits it needs.
 * - Indexes on milestones.achieved_at and scheduled_blocks.enabled —
 *   queries that filter by these grow O(n) without them.
 *
 * SQLite can't ALTER constraints, so the rebuild dance is the only way:
 * CREATE _new, INSERT … SELECT, DROP, RENAME. Wrapped in the migration
 * runner's outer transaction so a partial failure rolls back cleanly.
 *
 * After every INSERT … SELECT we count both sides and throw if rows
 * were silently dropped by the CHECK-filter WHERE clause. Without this
 * guard, a row with `duration = 999999` (or similar) would vanish on
 * upgrade with no error surfaced.
 */

function copyAndVerify(
  db: SQLiteDatabase,
  fromTable: string,
  insertSql: string,
): void {
  const before = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${fromTable}`,
  );
  const oldCount = before?.count ?? 0;
  db.execSync(insertSql);
  const after = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${fromTable}_new`,
  );
  const newCount = after?.count ?? 0;
  if (oldCount !== newCount) {
    throw new Error(
      `migration007: ${fromTable} row count mismatch (was ${oldCount}, kept ${newCount}) — refusing to silently drop user data`,
    );
  }
}

export const migration007: Migration = {
  version: 7,
  name: 'schema_hygiene',
  up: (db) => {
    // ── sessions ──────────────────────────────────────────────────────
    db.execSync(`
      CREATE TABLE sessions_new (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL DEFAULT 'local',
        timestamp  INTEGER NOT NULL,
        duration   INTEGER NOT NULL CHECK (duration > 0 AND duration <= 86400),
        mood       TEXT,
        deleted_at TEXT,
        version    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    copyAndVerify(db, 'sessions', `
      INSERT INTO sessions_new
        (id, user_id, timestamp, duration, mood, created_at, updated_at)
      SELECT
        id,
        COALESCE(user_id, 'local'),
        timestamp,
        duration,
        mood,
        created_at,
        updated_at
      FROM sessions
      WHERE duration > 0 AND duration <= 86400;
    `);
    db.execSync('DROP TABLE sessions;');
    db.execSync('ALTER TABLE sessions_new RENAME TO sessions;');
    db.execSync('CREATE INDEX idx_sessions_timestamp ON sessions(timestamp);');
    db.execSync('CREATE INDEX idx_sessions_user_id ON sessions(user_id);');

    // ── scheduled_blocks ──────────────────────────────────────────────
    db.execSync(`
      CREATE TABLE scheduled_blocks_new (
        id                  TEXT PRIMARY KEY,
        user_id             TEXT NOT NULL DEFAULT 'local',
        hour                INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
        minute              INTEGER NOT NULL CHECK (minute >= 0 AND minute < 60),
        duration_minutes    INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
        weekdays            TEXT NOT NULL DEFAULT '[]',
        enabled             INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        unlock_goal_minutes INTEGER NOT NULL DEFAULT 5 CHECK (unlock_goal_minutes >= 0),
        deleted_at          TEXT,
        version             INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    copyAndVerify(db, 'scheduled_blocks', `
      INSERT INTO scheduled_blocks_new
        (id, user_id, hour, minute, duration_minutes, weekdays, enabled,
         unlock_goal_minutes, created_at, updated_at)
      SELECT
        id,
        COALESCE(user_id, 'local'),
        hour, minute, duration_minutes, weekdays, enabled,
        unlock_goal_minutes, created_at, updated_at
      FROM scheduled_blocks
      WHERE hour >= 0 AND hour < 24
        AND minute >= 0 AND minute < 60
        AND duration_minutes > 0 AND duration_minutes <= 1440;
    `);
    db.execSync('DROP TABLE scheduled_blocks;');
    db.execSync('ALTER TABLE scheduled_blocks_new RENAME TO scheduled_blocks;');
    db.execSync('CREATE INDEX idx_scheduled_blocks_enabled ON scheduled_blocks(enabled);');

    // ── milestones ────────────────────────────────────────────────────
    db.execSync(`
      CREATE TABLE milestones_new (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL DEFAULT 'local',
        achieved_at INTEGER NOT NULL,
        deleted_at  TEXT,
        version     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    copyAndVerify(db, 'milestones', `
      INSERT INTO milestones_new (id, user_id, achieved_at, created_at)
      SELECT id, COALESCE(user_id, 'local'), achieved_at, created_at
      FROM milestones;
    `);
    db.execSync('DROP TABLE milestones;');
    db.execSync('ALTER TABLE milestones_new RENAME TO milestones;');
    db.execSync('CREATE UNIQUE INDEX idx_milestones_id_user ON milestones(id, user_id);');
    db.execSync('CREATE INDEX idx_milestones_achieved_at ON milestones(achieved_at);');

    // ── settings (only adds columns; no constraint changes) ───────────
    db.execSync('ALTER TABLE settings ADD COLUMN deleted_at TEXT;');
    db.execSync('ALTER TABLE settings ADD COLUMN version INTEGER NOT NULL DEFAULT 1;');
  },
};
