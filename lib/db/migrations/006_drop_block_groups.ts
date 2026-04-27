import type { Migration } from '../migrations';

export const migration006: Migration = {
  version: 6,
  name: 'drop_block_groups',
  up: (db) => {
    // Recreate scheduled_blocks without group_id. SQLite's ALTER TABLE
    // DROP COLUMN is only available on 3.35+, and the table-rebuild dance
    // works on every version expo-sqlite ships.
    db.execSync(`
      CREATE TABLE scheduled_blocks_new (
        id                  TEXT PRIMARY KEY,
        user_id             TEXT,
        hour                INTEGER NOT NULL,
        minute              INTEGER NOT NULL,
        duration_minutes    INTEGER NOT NULL,
        weekdays            TEXT NOT NULL DEFAULT '[]',
        enabled             INTEGER NOT NULL DEFAULT 1,
        unlock_goal_minutes INTEGER NOT NULL DEFAULT 5,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.execSync(`
      INSERT INTO scheduled_blocks_new
        (id, user_id, hour, minute, duration_minutes, weekdays, enabled,
         unlock_goal_minutes, created_at, updated_at)
      SELECT
        id, user_id, hour, minute, duration_minutes, weekdays, enabled,
        unlock_goal_minutes, created_at, updated_at
      FROM scheduled_blocks;
    `);

    db.execSync('DROP TABLE scheduled_blocks;');
    db.execSync('ALTER TABLE scheduled_blocks_new RENAME TO scheduled_blocks;');

    db.execSync('DROP TABLE IF EXISTS block_groups;');
  },
};
