/**
 * Weekday helpers — single source of truth.
 *
 * iOS / Expo notification convention is 1=Sun … 7=Sat. We display
 * Mon-first (everywhere except where iOS APIs require their native
 * order), so the labels and value list are sorted Mon→Sun.
 */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** Mon…Sun expressed in Expo weekday numbers (1=Sun, 2=Mon, …, 7=Sat). */
export const WEEKDAY_VALUES: number[] = [2, 3, 4, 5, 6, 7, 1];

/** Default "every day" set in Expo weekday numbers. */
export const ALL_DAYS: number[] = [1, 2, 3, 4, 5, 6, 7];
