export interface Session {
  id: string;
  timestamp: number;
  duration: number;
  mood?: string;
}

export interface Reminder {
  id: string;
  hour: number;
  minute: number;
  weekdays: number[];
  enabled: boolean;
}

export interface ScheduledBlock {
  id: string;
  hour: number;
  minute: number;
  durationMinutes: number;
  weekdays: number[];
  enabled: boolean;
  /** NULL = "All apps" sentinel. Otherwise points to block_groups.id */
  groupId: string | null;
  /** Minutes of "doing nothing" required to unlock apps inside the block window. */
  unlockGoalMinutes: number;
}

export interface BlockGroup {
  id: string;
  name: string;
}

export interface CheckinRow {
  id: string;
  timestamp: number;
  week_key: string;
  sleep: number;
  anxiety: number;
  focus: number;
  energy: number;
}

export interface MilestoneRow {
  id: string;
  achieved_at: number;
}
