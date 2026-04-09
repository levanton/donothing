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
