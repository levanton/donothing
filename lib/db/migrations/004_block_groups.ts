import type { Migration } from '../migrations';

export const migration004: Migration = {
  version: 4,
  name: 'block_groups',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS block_groups (
        id         TEXT PRIMARY KEY,
        user_id    TEXT,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Per-block group reference. NULL = "all apps" sentinel.
    db.execSync(`ALTER TABLE scheduled_blocks ADD COLUMN group_id TEXT;`);
  },
};
