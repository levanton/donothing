import type { Migration } from '../migrations';

export const migration003: Migration = {
  version: 3,
  name: 'reflection_checkin_milestones',
  up: (db) => {
    // Add mood column to sessions (nullable)
    db.execSync('ALTER TABLE sessions ADD COLUMN mood TEXT;');

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
