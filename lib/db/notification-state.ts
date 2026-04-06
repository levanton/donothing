import { getDeviceState, setDeviceState, deleteDeviceState } from './settings';

function stateKey(entityType: string, entityId: string): string {
  return `notification_ids:${entityType}:${entityId}`;
}

export function getNotificationIds(entityType: string, entityId: string): string[] {
  const raw = getDeviceState(stateKey(entityType, entityId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
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
