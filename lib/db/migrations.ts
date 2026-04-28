import type { SQLiteDatabase } from 'expo-sqlite';
import { migration001 } from './migrations/001_initial';
import { migration002 } from './migrations/002_seed_from_async_storage';
import { migration003 } from './migrations/003_reflection_checkin_milestones';
import { migration004 } from './migrations/004_block_groups';
import { migration005 } from './migrations/005_unlock_goal';
import { migration006 } from './migrations/006_drop_block_groups';

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
  migration006,
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

function isMigrationApplied(db: SQLiteDatabase, version: number): boolean {
  const row = db.getFirstSync<{ one: number }>(
    'SELECT 1 as one FROM _migrations WHERE version = ?',
    version,
  );
  return row != null;
}

/**
 * Run synchronous migrations (DDL/schema). Called from getDb() to ensure
 * tables exist before any query runs.
 */
export function runSyncMigrations(db: SQLiteDatabase): void {
  ensureMigrationsTable(db);

  for (const m of syncMigrations) {
    if (isMigrationApplied(db, m.version)) continue;
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

/**
 * Run async migrations (data seeding from AsyncStorage).
 * Called from initDatabase() during app startup.
 *
 * Uses `withTransactionAsync` instead of manual BEGIN/COMMIT — holding
 * a SQLite transaction open across an `await` boundary risks blocking
 * other writers and leaves the WAL inconsistent if the awaited promise
 * rejects in unexpected ways.
 */
export async function runAsyncMigrations(db: SQLiteDatabase): Promise<void> {
  for (const m of asyncMigrations) {
    if (isMigrationApplied(db, m.version)) continue;
    try {
      await db.withTransactionAsync(async () => {
        await m.up(db);
        db.runSync('INSERT INTO _migrations (version) VALUES (?)', m.version);
      });
    } catch (e) {
      throw new Error(`Migration ${m.version} (${m.name}) failed: ${e}`);
    }
  }
}
