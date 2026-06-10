import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { loadDbModules, resetDbState } from './helpers';
import { CURRENT_SCHEMA_VERSION } from '@/lib/db/migrations';
import { migration001 } from '@/lib/db/migrations/001_initial';
import { migration003 } from '@/lib/db/migrations/003_reflection_checkin_milestones';
import { migration004 } from '@/lib/db/migrations/004_block_groups';
import { migration005 } from '@/lib/db/migrations/005_unlock_goal';
import { migration006 } from '@/lib/db/migrations/006_drop_block_groups';
import { migration007 } from '@/lib/db/migrations/007_schema_hygiene';

// Migration version numbers actually shipped, in order. Pulled from
// lib/db/migrations.ts — keep in sync when a new migration is added.
const EXPECTED_VERSIONS = [1, 3, 4, 5, 6, 7, 8, 9];

afterEach(resetDbState);

describe('migrations', () => {
  it('applies every migration up to CURRENT_SCHEMA_VERSION on a fresh DB', () => {
    const { core } = loadDbModules();
    const db = core.getDb();
    const rows = db.getAllSync<{ version: number }>(
      'SELECT version FROM _migrations ORDER BY version ASC',
    );
    const applied = rows.map((r) => r.version);
    expect(applied).toEqual(EXPECTED_VERSIONS);
    expect(Math.max(...applied)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('creates every user-data table', () => {
    const { core } = loadDbModules();
    const db = core.getDb();
    const rows = db.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tables = rows.map((r) => r.name);
    for (const t of ['sessions', 'scheduled_blocks', 'milestones', 'device_state', 'settings']) {
      expect(tables).toContain(t);
    }
  });

  it('drops the legacy reminders table (migration008)', () => {
    const { core } = loadDbModules();
    const db = core.getDb();
    const row = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='reminders'`,
    );
    expect(row?.count).toBe(0);
  });

  it('is idempotent — calling getDb a second time does not re-apply migrations', () => {
    const { core } = loadDbModules();
    core.getDb();
    const db = core.getDb();
    const rows = db.getAllSync<{ version: number }>('SELECT version FROM _migrations');
    expect(rows.length).toBe(EXPECTED_VERSIONS.length);
  });
});

describe('migration007 corrupt-row resilience', () => {
  // A migration that throws re-runs and re-throws on EVERY launch —
  // the app is bricked for that user forever. Corrupt rows must be
  // dropped (explicitly, logged), never allowed to fail the copy.
  it('drops out-of-range rows instead of crash-looping', () => {
    const db = openDatabaseSync('migration007-corrupt-test.db') as SQLiteDatabase;
    // Build the pre-007 schema the same way the runner would.
    for (const m of [migration001, migration003, migration004, migration005, migration006]) {
      m.up(db);
    }
    db.execSync(`
      INSERT INTO sessions (id, timestamp, duration) VALUES
        ('good',         1700000000000, 300),
        ('bad-huge',     1700000000000, 1700000000000),
        ('bad-zero',     1700000000000, 0);
    `);
    db.execSync(`
      INSERT INTO scheduled_blocks (id, hour, minute, duration_minutes, enabled) VALUES
        ('good-b',      9, 0, 30,  1),
        ('bad-hour',   99, 0, 30,  1),
        ('bad-enabled', 9, 0, 30,  2);
    `);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => migration007.up(db)).not.toThrow();

    const sessionIds = db.getAllSync<{ id: string }>('SELECT id FROM sessions').map((r) => r.id);
    expect(sessionIds).toEqual(['good']);
    const blockIds = db.getAllSync<{ id: string }>('SELECT id FROM scheduled_blocks').map((r) => r.id);
    expect(blockIds).toEqual(['good-b']);
    // The drop is deliberate and must be loud, not silent.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sessions'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scheduled_blocks'));
    warn.mockRestore();
  });
});
