import { getDeviceState, setDeviceState, deleteDeviceState } from './settings';

function stateKey(entityType: string, entityId: string): string {
  return `notification_ids:${entityType}:${entityId}`;
}

export function getNotificationIds(entityType: string, entityId: string): string[] {
  const raw = getDeviceState(stateKey(entityType, entityId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // Corrupt-but-valid JSON (a number, an object) must not leak out as
    // string[] — callers iterate and pass entries to the notifications
    // API. Non-string entries are dropped for the same reason.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function setNotificationIds(entityType: string, entityId: string, ids: string[]): void {
  setDeviceState(stateKey(entityType, entityId), JSON.stringify(ids));
}

export function clearNotificationIds(entityType: string, entityId: string): void {
  deleteDeviceState(stateKey(entityType, entityId));
}
