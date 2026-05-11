import type { Migration } from '../migrations';

/**
 * Hygiene pass on top of migration007.
 *
 * - AFTER UPDATE triggers refresh `updated_at = datetime('now')` so
 *   call-sites no longer have to remember the column. Without these,
 *   any UPDATE that forgets the field silently breaks last-write-wins
 *   semantics for future sync.
 * - Extra indexes on `user_id` for milestones and scheduled_blocks —
 *   trivial cost today, prevents seq scans the moment multi-user
 *   filtering shows up.
 *
 * Triggers live inside SQLite so they fire even if a future code path
 * issues UPDATEs that bypass the helpers in lib/db/.
 */
export const migration009: Migration = {
  version: 9,
  name: 'hygiene_pass',
  up: (db) => {
    // ── updated_at triggers ───────────────────────────────────────────
    // OF clause prevents recursion: the trigger's own UPDATE of
    // updated_at would otherwise re-fire forever.
    db.execSync(`
      CREATE TRIGGER trg_sessions_updated_at
      AFTER UPDATE OF id, user_id, timestamp, duration, mood, deleted_at, version ON sessions
      FOR EACH ROW
      BEGIN
        UPDATE sessions SET updated_at = datetime('now') WHERE id = OLD.id;
      END;
    `);

    db.execSync(`
      CREATE TRIGGER trg_scheduled_blocks_updated_at
      AFTER UPDATE OF id, user_id, hour, minute, duration_minutes, weekdays, enabled, unlock_goal_minutes, deleted_at, version ON scheduled_blocks
      FOR EACH ROW
      BEGIN
        UPDATE scheduled_blocks SET updated_at = datetime('now') WHERE id = OLD.id;
      END;
    `);

    db.execSync(`
      CREATE TRIGGER trg_settings_updated_at
      AFTER UPDATE OF key, user_id, value, deleted_at, version ON settings
      FOR EACH ROW
      BEGIN
        UPDATE settings SET updated_at = datetime('now')
        WHERE key = OLD.key AND user_id = OLD.user_id;
      END;
    `);

    // ── extra indexes ─────────────────────────────────────────────────
    db.execSync(
      'CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);',
    );
    db.execSync(
      'CREATE INDEX IF NOT EXISTS idx_scheduled_blocks_user_id ON scheduled_blocks(user_id);',
    );
  },
};
