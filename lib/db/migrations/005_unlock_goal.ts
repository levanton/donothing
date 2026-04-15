import type { Migration } from '../migrations';

export const migration005: Migration = {
  version: 5,
  name: 'unlock_goal',
  up: (db) => {
    db.execSync(
      `ALTER TABLE scheduled_blocks ADD COLUMN unlock_goal_minutes INTEGER NOT NULL DEFAULT 5;`,
    );
  },
};
