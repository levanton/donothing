/**
 * Shared test helper for DB integration suites.
 *
 * lib/db/index.ts caches the SQLite singleton at the module level, so
 * tests that share state across files would re-use a stale connection
 * after the in-memory DB is reset. `loadDbModules()` wraps a fresh
 * module load in `jest.isolateModules` so every test gets clean
 * imports — and therefore a fresh singleton.
 *
 * Call `resetDbState()` from `afterEach` to drop in-memory tables
 * between tests.
 */

export function loadDbModules() {
  let core: typeof import('@/lib/db');
  let sessions: typeof import('@/lib/db/sessions');
  let blocks: typeof import('@/lib/db/scheduled-blocks');
  let milestones: typeof import('@/lib/db/milestones-db');
  let settings: typeof import('@/lib/db/settings');
  let notifState: typeof import('@/lib/db/notification-state');

  jest.isolateModules(() => {
    core = require('@/lib/db');
    sessions = require('@/lib/db/sessions');
    blocks = require('@/lib/db/scheduled-blocks');
    milestones = require('@/lib/db/milestones-db');
    settings = require('@/lib/db/settings');
    notifState = require('@/lib/db/notification-state');
  });

  return { core: core!, sessions: sessions!, blocks: blocks!, milestones: milestones!, settings: settings!, notifState: notifState! };
}

export function resetDbState(): void {
  const SQLite = require('expo-sqlite') as { __resetExpoSqliteMock?: () => void };
  SQLite.__resetExpoSqliteMock?.();
}
