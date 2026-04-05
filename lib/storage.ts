import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from './theme';

export interface Session {
  id: string;
  timestamp: number;
  duration: number;
}

export interface Reminder {
  id: string;
  hour: number;
  minute: number;
  /** Selected weekdays, Expo convention: 1=Sun 2=Mon … 7=Sat. Empty = every day. */
  weekdays: number[];
  enabled: boolean;
  notificationIds?: string[];
}

export interface ScheduledBlock {
  id: string;
  hour: number;
  minute: number;
  durationMinutes: number;
  /** Selected weekdays, Expo convention: 1=Sun 2=Mon … 7=Sat. Empty = every day. */
  weekdays: number[];
  enabled: boolean;
  notificationIds?: string[];
}

const SESSIONS_KEY = '@donothing/sessions';
const THEME_KEY = '@donothing/theme';
const DAILY_GOAL_KEY = '@donothing/dailyGoal';
const REMINDERS_KEY = '@donothing/reminders';
const SCHEDULED_BLOCKS_KEY = '@donothing/scheduledBlocks';

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

export async function addSession(duration: number): Promise<Session[]> {
  if (duration < 1) return await loadSessions();
  const sessions = await loadSessions();
  const session: Session = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    duration,
  };
  sessions.push(session);
  await saveSessions(sessions);
  return sessions;
}

export async function loadTheme(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export async function saveTheme(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {}
}

// --- Daily Goal ---

export async function loadDailyGoal(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_GOAL_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export async function saveDailyGoal(minutes: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_GOAL_KEY, String(minutes));
  } catch {}
}

// --- Reminders ---

export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch {}
}

// --- Scheduled Blocks ---

export async function loadScheduledBlocks(): Promise<ScheduledBlock[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_BLOCKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveScheduledBlocks(blocks: ScheduledBlock[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_BLOCKS_KEY, JSON.stringify(blocks));
  } catch {}
}
