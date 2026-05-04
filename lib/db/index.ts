import * as SQLite from 'expo-sqlite';
import { runSyncMigrations, runAsyncMigrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the database singleton. On first call, opens the DB,
 * enables WAL + foreign keys, and runs sync migrations (DDL)
 * so that all tables exist before any query.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('nothing.db');
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');
    runSyncMigrations(db);
  }
  return db;
}

/**
 * Run async migrations (e.g. data seeding from AsyncStorage).
 * Must be called during app init before relying on migrated data.
 */
export async function initDatabase(): Promise<void> {
  const database = getDb();
  await runAsyncMigrations(database);
}

/**
 * Drop every row from user-data tables. Powers the "delete account"
 * affordance (App Store requires it for any app with persistent
 * personal data, even when there's no remote account). The schema
 * stays — `_migrations` is preserved so the next session-write hits
 * the same tables instead of re-triggering DDL.
 *
 * Caller is responsible for stopping live timers, cancelling pending
 * notifications, and releasing the native screen-time shield. This
 * function only owns the SQLite slice.
 */
const USER_DATA_TABLES = [
  'sessions',
  'scheduled_blocks',
  'milestones',
  'weekly_checkins',
  'device_state',
  'settings',
] as const;

export function wipeUserData(): void {
  const database = getDb();
  database.withTransactionSync(() => {
    for (const table of USER_DATA_TABLES) {
      database.runSync(`DELETE FROM ${table}`);
    }
  });
}
