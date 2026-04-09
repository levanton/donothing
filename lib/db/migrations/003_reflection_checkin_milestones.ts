import type { Migration } from '../migrations';

export const migration003: Migration = {
  version: 3,
  name: 'reflection_checkin_milestones',
  up: (db) => {
    // Add mood column to sessions (nullable)
    db.execSync('ALTER TABLE sessions ADD COLUMN mood TEXT;');

    // Weekly wellness check-ins
    db.execSync(`
      CREATE TABLE IF NOT EXISTS weekly_checkins (
        id         TEXT PRIMARY KEY,
        user_id    TEXT,
        timestamp  INTEGER NOT NULL,
        week_key   TEXT NOT NULL,
        sleep      INTEGER NOT NULL,
        anxiety    INTEGER NOT NULL,
        focus      INTEGER NOT NULL,
        energy     INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.execSync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_week ON weekly_checkins(week_key, user_id);',
    );

    // Achieved milestones
    db.execSync(`
      CREATE TABLE IF NOT EXISTS milestones (
        id          TEXT PRIMARY KEY,
        user_id     TEXT,
        achieved_at INTEGER NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.execSync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_id_user ON milestones(id, user_id);',
    );
  },
};
