export interface Session {
  id: string;
  timestamp: number;
  duration: number;
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
