export interface Session {
  id: string;
  timestamp: number;
  duration: number;
  mood?: string;
}

export interface ScheduledBlock {
  id: string;
  hour: number;
  minute: number;
  durationMinutes: number;
  weekdays: number[];
  enabled: boolean;
  /** Minutes of "doing nothing" required to unlock apps inside the block window. */
  unlockGoalMinutes: number;
}

export interface MilestoneRow {
  id: string;
  achieved_at: number;
}
