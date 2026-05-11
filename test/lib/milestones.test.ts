/**
 * Milestones evaluate against DB stats — mock the DB getters and the
 * stats.getStreak helper so each rule can be exercised in isolation.
 */

jest.mock('@/lib/db/sessions', () => ({
  getSessionCount: jest.fn(),
  getLongestSessionDuration: jest.fn(),
  getActiveDaysCount: jest.fn(),
  getTotalDuration: jest.fn(),
}));

jest.mock('@/lib/db/milestones-db', () => ({
  getAchievedMilestones: jest.fn(),
  insertMilestone: jest.fn(),
}));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn(),
}));

import {
  getSessionCount,
  getLongestSessionDuration,
  getActiveDaysCount,
  getTotalDuration,
} from '@/lib/db/sessions';
import { getAchievedMilestones, insertMilestone } from '@/lib/db/milestones-db';
import { getStreak } from '@/lib/stats';
import { MILESTONES, evaluateAndSaveNewMilestones } from '@/lib/milestones';

const sessionCount = getSessionCount as jest.MockedFunction<typeof getSessionCount>;
const longest = getLongestSessionDuration as jest.MockedFunction<typeof getLongestSessionDuration>;
const activeDays = getActiveDaysCount as jest.MockedFunction<typeof getActiveDaysCount>;
const total = getTotalDuration as jest.MockedFunction<typeof getTotalDuration>;
const achieved = getAchievedMilestones as jest.MockedFunction<typeof getAchievedMilestones>;
const insertM = insertMilestone as jest.MockedFunction<typeof insertMilestone>;
const streak = getStreak as jest.MockedFunction<typeof getStreak>;

beforeEach(() => {
  [sessionCount, longest, activeDays, total, achieved, insertM, streak].forEach((m) => m.mockReset());
  achieved.mockReturnValue(new Map());
  sessionCount.mockReturnValue(0);
  longest.mockReturnValue(0);
  activeDays.mockReturnValue(0);
  total.mockReturnValue(0);
  streak.mockReturnValue(0);
});

describe('MILESTONES definitions', () => {
  it('has unique ids', () => {
    const ids = MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every milestone has title, description, check', () => {
    for (const m of MILESTONES) {
      expect(m.title).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(typeof m.check).toBe('function');
    }
  });
});

describe('evaluateAndSaveNewMilestones', () => {
  it('returns nothing when no thresholds are met', () => {
    expect(evaluateAndSaveNewMilestones()).toEqual([]);
    expect(insertM).not.toHaveBeenCalled();
  });

  it('awards first_session at one session', () => {
    sessionCount.mockReturnValue(1);
    const out = evaluateAndSaveNewMilestones();
    expect(out).toContain('first_session');
    expect(insertM).toHaveBeenCalledWith('first_session');
  });

  it('does not re-award already-achieved milestones', () => {
    sessionCount.mockReturnValue(1);
    achieved.mockReturnValue(new Map([['first_session', 1]]));
    const out = evaluateAndSaveNewMilestones();
    expect(out).not.toContain('first_session');
  });

  it('streak_7 awards when streak ≥ 7', () => {
    streak.mockReturnValue(7);
    sessionCount.mockReturnValue(1);
    const out = evaluateAndSaveNewMilestones();
    expect(out).toEqual(expect.arrayContaining(['first_session', 'streak_3', 'streak_7']));
  });

  it('one_hour_session needs a 3600s longest session', () => {
    longest.mockReturnValue(3600);
    sessionCount.mockReturnValue(1);
    const out = evaluateAndSaveNewMilestones();
    expect(out).toContain('one_hour_session');
    expect(out).toContain('thirty_minutes');
    expect(out).toContain('five_minutes');
  });

  it('twenty_four_hours awards once total duration crosses 86400s', () => {
    total.mockReturnValue(86400);
    sessionCount.mockReturnValue(1);
    const out = evaluateAndSaveNewMilestones();
    expect(out).toContain('twenty_four_hours');
  });

  it('days_100 needs 100 active days', () => {
    activeDays.mockReturnValue(100);
    sessionCount.mockReturnValue(1);
    const out = evaluateAndSaveNewMilestones();
    expect(out).toContain('days_100');
  });
});
