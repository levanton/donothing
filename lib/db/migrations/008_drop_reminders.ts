import type { Migration } from '../migrations';

/**
 * Drop the orphan `reminders` table. Created in migration001 but never
 * read or written by any app code. Removing it now (rather than leaving
 * it as decoration) prevents future devs from wiring against a dead
 * table and shrinks the schema surface that has to migrate to Supabase.
 */
export const migration008: Migration = {
  version: 8,
  name: 'drop_reminders',
  up: (db) => {
    db.execSync('DROP TABLE IF EXISTS reminders;');
  },
};
