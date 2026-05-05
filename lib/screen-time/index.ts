// Barrel re-exports so callers keep using `from '@/lib/screen-time'`.
// Internal module split:
//   - actions.ts  — typed DeviceActivity action union
//   - auth.ts     — Screen Time authorization flow
//   - shield.ts   — shield UI config + state queries + Darwin event listener
//   - schedule.ts — block scheduling, unscheduling, reconciliation

export type { DeviceActivityAction, NotificationActionPayload } from './actions';
export type { AuthStatus } from './auth';
export { getAuth, requestAuth } from './auth';
export {
  NEVER_BLOCK_SELECTION_ID,
  SHIELD_ACTIONS,
  SHIELD_CONFIG,
  copyShieldIcon,
  isBlockActive,
  onBlockShieldRaised,
} from './shield';
export {
  forceUnblockAll,
  getActiveMonitors,
  reconcileBlocks,
  scheduleBlock,
  unscheduleBlock,
} from './schedule';
