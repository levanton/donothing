import { randomUUID } from 'expo-crypto';
import { getDb } from './index';
import type { BlockGroup } from './types';

interface GroupRow {
  id: string;
  name: string;
}

export function getAllBlockGroups(): BlockGroup[] {
  const db = getDb();
  return db.getAllSync<GroupRow>(
    'SELECT id, name FROM block_groups ORDER BY created_at ASC',
  );
}

export function insertBlockGroup(name: string): BlockGroup {
  const db = getDb();
  const id = randomUUID();
  db.runSync(
    'INSERT INTO block_groups (id, name) VALUES (?, ?)',
    id, name,
  );
  return { id, name };
}

export function renameBlockGroup(id: string, name: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE block_groups SET name = ?, updated_at = datetime('now') WHERE id = ?`,
    name, id,
  );
}

export function deleteBlockGroup(id: string): void {
  const db = getDb();
  // Detach from any scheduled_blocks — they fall back to "All apps".
  db.runSync('UPDATE scheduled_blocks SET group_id = NULL WHERE group_id = ?', id);
  db.runSync('DELETE FROM block_groups WHERE id = ?', id);
}
