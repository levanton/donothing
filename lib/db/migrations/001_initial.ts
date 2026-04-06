import type { Migration } from '../migrations';

export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        user_id    TEXT,
        timestamp  INTEGER NOT NULL,
        duration   INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.execSync('CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);');

    db.execSync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id         TEXT PRIMARY KEY,
        user_id    TEXT,
        hour       INTEGER NOT NULL,
        minute     INTEGER NOT NULL,
        weekdays   TEXT NOT NULL DEFAULT '[]',
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS scheduled_blocks (
        id               TEXT PRIMARY KEY,
        user_id          TEXT,
        hour             INTEGER NOT NULL,
        minute           INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        weekdays         TEXT NOT NULL DEFAULT '[]',
        enabled          INTEGER NOT NULL DEFAULT 1,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS device_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT NOT NULL,
        user_id    TEXT NOT NULL DEFAULT 'local',
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (key, user_id)
      );
    `);
  },
};
