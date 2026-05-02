/**
 * Runtime schemas for everything that gets written to SQLite.
 *
 * Pattern: **normalize at write, trust at read.** Every DB-write
 * function in lib/db/*.ts runs its inputs through one of these
 * `.parse()` calls before issuing SQL. That way:
 *
 *  - Invalid values (out-of-range hour, empty weekdays, dupes,
 *    sub-second sessions) are rejected or coerced at the boundary.
 *  - Read paths can assume the data is well-formed — no more
 *    "is this empty array `every-day` or `nothing-selected`?"
 *    interpretation drift across components.
 *
 * Add a new schema here whenever a new entity gets persisted.
 */

import { z } from 'zod';

// ── ScheduledBlock ──────────────────────────────────────────────────
//
// `weekdays` is the historic source of bugs: empty array used to mean
// "every day" in some places and "nothing" in others. The transform
// below collapses that ambiguity:
//   - empty input → all 7 days
//   - duplicates removed
//   - clamped to [1, 7]
//   - sorted ascending
// Downstream code can now safely write `weekdays.includes(day)` without
// the `!weekdays?.length || ...` guard.

const WEEKDAYS_FULL = [1, 2, 3, 4, 5, 6, 7] as const;

const WeekdaysSchema = z
  .array(z.number().int())
  .transform((days) => {
    const cleaned = Array.from(
      new Set(days.filter((d) => d >= 1 && d <= 7)),
    ).sort((a, b) => a - b);
    return cleaned.length > 0 ? cleaned : [...WEEKDAYS_FULL];
  });

export const ScheduledBlockInputSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  durationMinutes: z.number().int().min(1).max(480),
  weekdays: WeekdaysSchema,
  unlockGoalMinutes: z.number().int().min(1).max(60).default(5),
});

export type ScheduledBlockInput = z.infer<typeof ScheduledBlockInputSchema>;

// ── Session ─────────────────────────────────────────────────────────
//
// Bounds match MIN_SAVABLE_DURATION (60s) and MAX_SESSION_DURATION
// (24h) from sessions.ts. We re-state them here so the schema is the
// single source of truth — sessions.ts can read constants off it later
// if we want to consolidate further.

export const SESSION_MIN_DURATION_S = 60;
export const SESSION_MAX_DURATION_S = 24 * 60 * 60;

export const SessionInputSchema = z.object({
  duration: z.number().int().min(SESSION_MIN_DURATION_S).max(SESSION_MAX_DURATION_S),
});

export type SessionInput = z.infer<typeof SessionInputSchema>;

// ── Boolean flags persisted to settings table ──────────────────────
// Stored as the literal string '1' (presence = true, absence = false).
// Re-used by onboardingComplete and tutorialCompleted; parse before
// every write so we never persist anything ambiguous.

export const BooleanFlagSchema = z.literal('1');
export type BooleanFlag = z.infer<typeof BooleanFlagSchema>;
