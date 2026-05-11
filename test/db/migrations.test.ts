import { loadDbModules, resetDbState } from './helpers';
import { CURRENT_SCHEMA_VERSION } from '@/lib/db/migrations';

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
