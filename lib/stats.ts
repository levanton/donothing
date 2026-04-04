import { Session } from './storage';

export interface Stats {
  today: number;
  week: number;
  year: number;
}

export interface DayStats {
  date: string;      // "YYYY-MM-DD"
  label: string;     // "Today", "Yesterday", "Mon 31 Mar"
  duration: number;  // total seconds
}

export function getStats(sessions: Session[]): Stats {
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfWeek = startOfDay - dayOfWeek * 86400000;

  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  let today = 0;
  let week = 0;
  let year = 0;

  for (const s of sessions) {
    if (s.timestamp >= startOfYear) year += s.duration;
    if (s.timestamp >= startOfWeek) week += s.duration;
    if (s.timestamp >= startOfDay) today += s.duration;
  }

  return { today, week, year };
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date, todayKey: string, yesterdayKey: string): string {
  const key = dateKey(d);
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** Count consecutive days with at least one session, ending today */
export function getStreak(sessions: Session[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    days.add(dateKey(new Date(s.timestamp)));
  }

  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (days.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getDailyStats(sessions: Session[], days: number = 30): DayStats[] {
  const now = new Date();
  const todayKey = dateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  // Group sessions by day
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const key = dateKey(d);
    byDay.set(key, (byDay.get(key) || 0) + s.duration);
  }

  // Build last N days
  const result: DayStats[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const duration = byDay.get(key) || 0;
    if (duration > 0 || i < 7) {
      result.push({
        date: key,
        label: dayLabel(d, todayKey, yesterdayKey),
        duration,
      });
    }
  }

  return result;
}
