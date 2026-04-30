import { getSessionCount } from './db/sessions';
import { getStreak, getWeekStats } from './stats';

export interface JourneyTag {
  id: string;
  label: string;
  type: 'stage' | 'streak' | 'achievement';
}

/** Compute dynamic tags based on current user stats */
export function getJourneyTags(): JourneyTag[] {
  const tags: JourneyTag[] = [];
  const sessions = getSessionCount();
  const streak = getStreak();
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

  return tags;
}
