import { getDurationSince, getWeekDurations, getDailyDurations, getDistinctDatesDesc } from './db/sessions';

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

export interface WeekDay {
  date: string;
  dayName: string;   // "Mon", "Tue", ...
  duration: number;
  isToday: boolean;
}

export function getStats(): Stats {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const startOfWeek = startOfDay - dayOfWeek * 86400000;
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  return {
    today: getDurationSince(startOfDay),
    week: getDurationSince(startOfWeek),
    year: getDurationSince(startOfYear),
  };
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
export function getStreak(): number {
  const dates = getDistinctDatesDesc(365);
  const dateSet = new Set(dates);

  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
    if (dateSet.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Returns current week with durations, respecting locale week start */
export function getWeekStats(startsOnSunday?: boolean): WeekDay[] {
  const now = new Date();
  const todayKey = dateKey(now);

  const sundayStart = startsOnSunday ?? isSundayStartLocale();

  const jsDay = now.getDay();
  const offset = sundayStart ? jsDay : (jsDay === 0 ? 6 : jsDay - 1);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - offset);
  const weekStartMs = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime();
  const weekEndMs = weekStartMs + 7 * 86400000;

  const byDay = getWeekDurations(weekStartMs, weekEndMs);

  const dayNames = sundayStart
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const result: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    result.push({
      date: key,
      dayName: dayNames[i],
      duration: byDay.get(key) || 0,
      isToday: key === todayKey,
    });
  }
  return result;
}

/** Heuristic: US, CA, JP, etc. start week on Sunday */
function isSundayStartLocale(): boolean {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split('-').pop()?.toUpperCase() ?? '';
    const sundayCountries = ['US', 'CA', 'JP', 'IL', 'KR', 'TW', 'PH', 'SA', 'AE'];
    return sundayCountries.includes(region);
  } catch {
    return false;
  }
}

export function getDailyStats(days: number = 30): DayStats[] {
  const now = new Date();
  const todayKey = dateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  const byDay = getDailyDurations(days);

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
