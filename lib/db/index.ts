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
