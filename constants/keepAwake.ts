// The single registry of expo-keep-awake tags used across the app. Each
// activate call must be matched by a deactivate with the SAME tag, or
// the screen never sleeps. Strings scattered across files invite typos
// (one mismatched literal = a silent battery leak), so every call site
// references these constants instead.
//
//   SESSION    a do-nothing session is live (armed → celebrating).
//   FOCUS      legacy focus-lock keep-awake, dropped on focusStep idle.
//   BLOCK      a scheduled-block shield is up / its unlock UI is showing.
//   ONBOARDING the first-run "try nothing" rehearsal session.
export const KEEP_AWAKE = {
  SESSION: 'session',
  FOCUS: 'focus',
  BLOCK: 'scheduled-block',
  ONBOARDING: 'onboarding-session',
} as const;

export type KeepAwakeTag = (typeof KEEP_AWAKE)[keyof typeof KEEP_AWAKE];
