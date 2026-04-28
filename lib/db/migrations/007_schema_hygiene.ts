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
 */
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
    db.execSync(`
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
    db.execSync(`
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
    db.execSync(`
      INSERT INTO milestones_new (id, user_id, achieved_at, created_at)
      SELECT id, COALESCE(user_id, 'local'), achieved_at, created_at
      FROM milestones;
    `);
    db.execSync('DROP TABLE milestones;');
    db.execSync('ALTER TABLE milestones_new RENAME TO milestones;');
    db.execSync('CREATE UNIQUE INDEX idx_milestones_id_user ON milestones(id, user_id);');
    db.execSync('CREATE INDEX idx_milestones_achieved_at ON milestones(achieved_at);');

    // ── weekly_checkins ───────────────────────────────────────────────
    db.execSync(`
      CREATE TABLE weekly_checkins_new (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL DEFAULT 'local',
        timestamp  INTEGER NOT NULL,
        week_key   TEXT NOT NULL,
        sleep      INTEGER NOT NULL CHECK (sleep BETWEEN 0 AND 10),
        anxiety    INTEGER NOT NULL CHECK (anxiety BETWEEN 0 AND 10),
        focus      INTEGER NOT NULL CHECK (focus BETWEEN 0 AND 10),
        energy     INTEGER NOT NULL CHECK (energy BETWEEN 0 AND 10),
        deleted_at TEXT,
        version    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.execSync(`
      INSERT INTO weekly_checkins_new
        (id, user_id, timestamp, week_key, sleep, anxiety, focus, energy,
         created_at, updated_at)
      SELECT
        id, COALESCE(user_id, 'local'), timestamp, week_key,
        sleep, anxiety, focus, energy,
        created_at, updated_at
      FROM weekly_checkins
      WHERE sleep BETWEEN 0 AND 10
        AND anxiety BETWEEN 0 AND 10
        AND focus BETWEEN 0 AND 10
        AND energy BETWEEN 0 AND 10;
    `);
    db.execSync('DROP TABLE weekly_checkins;');
    db.execSync('ALTER TABLE weekly_checkins_new RENAME TO weekly_checkins;');
    db.execSync(
      'CREATE UNIQUE INDEX idx_checkins_week ON weekly_checkins(week_key, user_id);',
    );

    // ── settings (only adds columns; no constraint changes) ───────────
    db.execSync('ALTER TABLE settings ADD COLUMN deleted_at TEXT;');
    db.execSync('ALTER TABLE settings ADD COLUMN version INTEGER NOT NULL DEFAULT 1;');
  },
};
