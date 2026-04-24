import { getSessionCount, getLongestSessionDuration, getTotalDuration } from './db/sessions';
import { getStreak, getWeekStats } from './stats';

export interface JourneyTag {
  id: string;
  label: string;
  type: 'stage' | 'streak' | 'achievement' | 'goal';
}

/** Compute dynamic tags based on current user stats */
export function getJourneyTags(dailyGoalMinutes: number, todayDuration: number): JourneyTag[] {
  const tags: JourneyTag[] = [];
  const sessions = getSessionCount();
  const streak = getStreak();
  const longest = getLongestSessionDuration();
  const total = getTotalDuration();
  const week = getWeekStats();

  // ── Stage tag (always exactly one) ──────────────────────────────
  if (sessions === 0) {
    // no tag yet
  } else if (sessions < 10) {
    tags.push({ id: 'stage', label: 'beginner', type: 'stage' });
  } else if (sessions < 50) {
    tags.push({ id: 'stage', label: 'building', type: 'stage' });
  } else if (sessions < 100) {
    tags.push({ id: 'stage', label: 'steady', type: 'stage' });
  } else if (sessions < 200) {
    tags.push({ id: 'stage', label: 'devoted', type: 'stage' });
  } else {
    tags.push({ id: 'stage', label: 'still', type: 'stage' });
  }

  // ── Streak tags ─────────────────────────────────────────────────
  if (streak >= 3) {
    tags.push({ id: 'streak', label: `${streak}-day streak`, type: 'streak' });
  }

  // ── Achievement tags (temporary, context-aware) ─────────────────
  // "consistent" — did something every day this week so far
  const daysPassedThisWeek = week.filter((d) => {
    const dayDate = new Date(d.date);
    return dayDate <= new Date();
  });
  const allDaysActive = daysPassedThisWeek.length > 0 &&
    daysPassedThisWeek.every((d) => d.duration > 0);
  if (allDaysActive && daysPassedThisWeek.length >= 3) {
    tags.push({ id: 'consistent', label: 'consistent', type: 'achievement' });
  }

  // ── Goal tag ────────────────────────────────────────────────────
  if (dailyGoalMinutes > 0) {
    const goalSeconds = dailyGoalMinutes * 60;
    if (todayDuration >= goalSeconds) {
      tags.push({ id: 'goal', label: 'goal reached', type: 'goal' });
    } else if (todayDuration > 0) {
      tags.push({ id: 'goal', label: `${dailyGoalMinutes}m goal`, type: 'goal' });
    }
  }

  return tags;
}
