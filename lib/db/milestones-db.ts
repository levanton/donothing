import { getDb } from './index';
import type { MilestoneRow } from './types';

export function getAchievedMilestones(): Map<string, number> {
  const db = getDb();
  const rows = db.getAllSync<MilestoneRow>(
    'SELECT id, achieved_at FROM milestones ORDER BY achieved_at ASC',
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.id, r.achieved_at);
  }
  return map;
}

export function insertMilestone(id: string): void {
  // user_id is omitted so the column's DEFAULT 'local' applies — passing
  // NULL would violate the NOT NULL constraint added in migration007.
  const db = getDb();
  db.runSync(
    'INSERT INTO milestones (id, achieved_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING',
    id,
    Date.now(),
  );
}

export function isMilestoneAchieved(id: string): boolean {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM milestones WHERE id = ?',
    id,
  );
  return (row?.count ?? 0) > 0;
}
