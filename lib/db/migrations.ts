import type { SQLiteDatabase } from 'expo-sqlite';
import { migration001 } from './migrations/001_initial';
import { migration002 } from './migrations/002_seed_from_async_storage';
import { migration003 } from './migrations/003_reflection_checkin_milestones';
import { migration004 } from './migrations/004_block_groups';
import { migration005 } from './migrations/005_unlock_goal';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void | Promise<void>;
}

const syncMigrations: Migration[] = [
  migration001,
  migration003,
  migration004,
  migration005,
];

const asyncMigrations: Migration[] = [
  migration002,
];

function ensureMigrationsTable(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getCurrentVersion(db: SQLiteDatabase): number {
  const row = db.getFirstSync<{ max_v: number | null }>(
    'SELECT MAX(version) as max_v FROM _migrations',
  );
  return row?.max_v ?? 0;
}

/**
 * Run synchronous migrations (DDL/schema). Called from getDb() to ensure
 * tables exist before any query runs.
 */
export function runSyncMigrations(db: SQLiteDatabase): void {
  ensureMigrationsTable(db);
  const currentVersion = getCurrentVersion(db);

  for (const m of syncMigrations) {
    if (m.version > currentVersion) {
      db.execSync('BEGIN TRANSACTION');
      try {
        m.up(db);
        db.runSync('INSERT INTO _migrations (version) VALUES (?)', m.version);
        db.execSync('COMMIT');
      } catch (e) {
        db.execSync('ROLLBACK');
        throw new Error(`Migration ${m.version} (${m.name}) failed: ${e}`);
      }
    }
  }
}

/**
 * Run async migrations (data seeding from AsyncStorage).
 * Called from initDatabase() during app startup.
 */
export async function runAsyncMigrations(db: SQLiteDatabase): Promise<void> {
  const currentVersion = getCurrentVersion(db);

  for (const m of asyncMigrations) {
    if (m.version > currentVersion) {
      try {
        db.execSync('BEGIN TRANSACTION');
        await m.up(db);
        db.runSync('INSERT INTO _migrations (version) VALUES (?)', m.version);
        db.execSync('COMMIT');
      } catch (e) {
        db.execSync('ROLLBACK');
        throw new Error(`Migration ${m.version} (${m.name}) failed: ${e}`);
      }
    }
  }
}
