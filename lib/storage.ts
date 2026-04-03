import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from './theme';

export interface Session {
  id: string;
  timestamp: number;
  duration: number;
}

const SESSIONS_KEY = '@donothing/sessions';
const THEME_KEY = '@donothing/theme';

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
