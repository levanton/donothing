import {
  getSessionCount,
  getLongestSessionDuration,
  getActiveDaysCount,
  getTotalDuration,
} from './db/sessions';
import { getStreak } from './stats';
import { getAchievedMilestones, insertMilestone } from './db/milestones-db';

export interface MilestoneDef {
  id: string;
  title: string;
  description: string;
  check: (stats: MilestoneStats) => boolean;
}

export interface MilestoneStats {
  totalSessions: number;
  totalDuration: number;
  currentStreak: number;
  longestSession: number;
  activeDays: number;
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: 'first_session',
    title: 'first breath',
    description: 'you chose to stop. that takes courage.',
    check: (s) => s.totalSessions >= 1,
  },
  {
    id: 'five_minutes',
    title: 'five minutes of nothing',
    description: 'five minutes without reaching for your phone.',
    check: (s) => s.longestSession >= 300,
  },
  {
    id: 'ten_sessions',
    title: 'finding a rhythm',
    description: 'ten times you chose stillness over noise.',
    check: (s) => s.totalSessions >= 10,
  },
  {
    id: 'first_hour',
    title: 'an hour of stillness',
    description: 'one full hour reclaimed from the scroll.',
    check: (s) => s.totalDuration >= 3600,
  },
  {
    id: 'streak_3',
    title: 'three days running',
    description: 'something is shifting inside you.',
    check: (s) => s.currentStreak >= 3,
  },
  {
    id: 'thirty_minutes',
    title: 'half an hour, whole peace',
    description: 'thirty uninterrupted minutes. the world waited.',
    check: (s) => s.longestSession >= 1800,
  },
  {
    id: 'streak_7',
    title: 'one week of presence',
    description: 'seven days. this is becoming who you are.',
    check: (s) => s.currentStreak >= 7,
  },
  {
    id: 'fifty_sessions',
    title: 'a quiet habit',
    description: 'fifty pauses. not a phase — a practice.',
    check: (s) => s.totalSessions >= 50,
  },
  {
    id: 'five_hours',
    title: 'five hours reclaimed',
    description: 'five hours you gave back to yourself.',
    check: (s) => s.totalDuration >= 18000,
  },
  {
    id: 'streak_14',
    title: 'two weeks of stillness',
    description: 'two weeks. your brain is remembering how to rest.',
    check: (s) => s.currentStreak >= 14,
  },
  {
    id: 'one_hour_session',
    title: 'an hour in one sitting',
    description: 'sixty minutes of nothing. that is rare and real.',
    check: (s) => s.longestSession >= 3600,
  },
  {
    id: 'hundred_sessions',
    title: 'a hundred pauses',
    description: 'a hundred times you chose presence.',
    check: (s) => s.totalSessions >= 100,
  },
  {
    id: 'streak_30',
    title: 'a month of nothing',
    description: 'thirty days. people around you can feel it.',
    check: (s) => s.currentStreak >= 30,
  },
  {
    id: 'twenty_four_hours',
    title: 'a full day of peace',
    description: 'twenty-four hours of total stillness. a whole day returned.',
    check: (s) => s.totalDuration >= 86400,
  },
  {
    id: 'days_100',
    title: 'one hundred days',
    description: 'one hundred days of choosing to just... be.',
    check: (s) => s.activeDays >= 100,
  },
];

/** Gather current stats from the database */
export function getMilestoneStats(): MilestoneStats {
  return {
    totalSessions: getSessionCount(),
    totalDuration: getTotalDuration(),
    currentStreak: getStreak(),
    longestSession: getLongestSessionDuration(),
    activeDays: getActiveDaysCount(),
  };
}

/**
 * Evaluate all milestones against current stats.
 * Returns IDs of newly achieved milestones (not yet in DB).
 * Saves them to DB immediately.
 */
export function evaluateAndSaveNewMilestones(): string[] {
  const achieved = getAchievedMilestones();
  const stats = getMilestoneStats();
  const newIds: string[] = [];

  for (const m of MILESTONES) {
    if (!achieved.has(m.id) && m.check(stats)) {
      insertMilestone(m.id);
      newIds.push(m.id);
    }
  }

  return newIds;
}
