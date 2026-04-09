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
  const db = getDb();
  db.runSync(
    'INSERT OR IGNORE INTO milestones (id, user_id, achieved_at) VALUES (?, NULL, ?)',
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
