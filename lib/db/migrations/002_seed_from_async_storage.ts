import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Migration } from '../migrations';

const SESSIONS_KEY = '@donothing/sessions';
const THEME_KEY = '@donothing/theme';
const DAILY_GOAL_KEY = '@donothing/dailyGoal';
const REMINDERS_KEY = '@donothing/reminders';
const SCHEDULED_BLOCKS_KEY = '@donothing/scheduledBlocks';

export const migration002: Migration = {
  version: 2,
  name: 'seed_from_async_storage',
  up: async (db) => {
    // Each entity is wrapped independently so a corrupt JSON for one key
    // doesn't block the rest from migrating. We log every failure rather
    // than swallowing — a silent drop here means the user permanently
    // loses pre-SQLite data without any indication.

    // --- Sessions ---
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const sessions: Array<{ id: string; timestamp: number; duration: number }> = JSON.parse(raw);
        for (const s of sessions) {
          db.runSync(
            'INSERT OR IGNORE INTO sessions (id, timestamp, duration) VALUES (?, ?, ?)',
            s.id, s.timestamp, s.duration,
          );
        }
      }
    } catch (e) {
      console.error('[migration002] sessions seed failed:', e);
    }

    // --- Theme ---
    try {
      const theme = await AsyncStorage.getItem(THEME_KEY);
      if (theme) {
        db.runSync(
          `INSERT OR IGNORE INTO device_state (key, value) VALUES ('theme', ?)`,
          theme,
        );
      }
    } catch (e) {
      console.error('[migration002] theme seed failed:', e);
    }

    // --- Daily Goal ---
    try {
      const goal = await AsyncStorage.getItem(DAILY_GOAL_KEY);
      if (goal) {
        db.runSync(
          `INSERT OR IGNORE INTO settings (key, user_id, value) VALUES ('dailyGoal', 'local', ?)`,
          goal,
        );
      }
    } catch (e) {
      console.error('[migration002] dailyGoal seed failed:', e);
    }

    // --- Reminders ---
    try {
      const raw = await AsyncStorage.getItem(REMINDERS_KEY);
      if (raw) {
        const reminders: Array<{
          id: string; hour: number; minute: number;
          weekdays?: number[]; enabled: boolean;
          notificationIds?: string[]; notificationId?: string;
        }> = JSON.parse(raw);
        for (const r of reminders) {
          db.runSync(
            'INSERT OR IGNORE INTO reminders (id, hour, minute, weekdays, enabled) VALUES (?, ?, ?, ?, ?)',
            r.id, r.hour, r.minute,
            JSON.stringify(r.weekdays ?? []),
            r.enabled ? 1 : 0,
          );
          // Migrate notificationIds to device_state
          const ids = r.notificationIds ?? (r.notificationId ? [r.notificationId] : []);
          if (ids.length > 0) {
            db.runSync(
              `INSERT OR IGNORE INTO device_state (key, value) VALUES (?, ?)`,
              `notification_ids:reminder:${r.id}`,
              JSON.stringify(ids),
            );
          }
        }
      }
    } catch (e) {
      console.error('[migration002] reminders seed failed:', e);
    }

    // --- Scheduled Blocks ---
    try {
      const raw = await AsyncStorage.getItem(SCHEDULED_BLOCKS_KEY);
      if (raw) {
        const blocks: Array<{
          id: string; hour: number; minute: number; durationMinutes: number;
          weekdays?: number[]; enabled: boolean;
          notificationIds?: string[]; notificationId?: string;
        }> = JSON.parse(raw);
        for (const b of blocks) {
          db.runSync(
            'INSERT OR IGNORE INTO scheduled_blocks (id, hour, minute, duration_minutes, weekdays, enabled) VALUES (?, ?, ?, ?, ?, ?)',
            b.id, b.hour, b.minute, b.durationMinutes,
            JSON.stringify(b.weekdays ?? []),
            b.enabled ? 1 : 0,
          );
          const ids = b.notificationIds ?? (b.notificationId ? [b.notificationId] : []);
          if (ids.length > 0) {
            db.runSync(
              `INSERT OR IGNORE INTO device_state (key, value) VALUES (?, ?)`,
              `notification_ids:scheduledBlock:${b.id}`,
              JSON.stringify(ids),
            );
          }
        }
      }
    } catch (e) {
      console.error('[migration002] scheduled_blocks seed failed:', e);
    }
  },
};
