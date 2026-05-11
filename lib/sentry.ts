import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ErrorInfo } from 'react';

/**
 * Single seam for Sentry. Everything else talks to `initSentry()` /
 * `captureError()` / `wrap()` — keeps the SDK off the public surface
 * so swapping crash reporters later is one file.
 *
 * DSN resolution (first match wins):
 *   1. `EXPO_PUBLIC_SENTRY_DSN` env var (build-time inlined by Expo)
 *   2. `expoConfig.extra.sentryDsn` from app.json
 *
 * If no DSN is configured we no-op silently in production and warn
 * once in __DEV__ so a forgotten setup is loud during dev but doesn't
 * crash builds where Sentry isn't wanted.
 *
 * --- Privacy / cost choices ---
 *
 * `sendDefaultPii: false` — wellness apps face stricter App Store
 *   privacy scrutiny. IP addresses + cookies + user identifiers in
 *   error events would force a "Sensitive Info" declaration on the
 *   privacy nutrition label. Errors don't need them.
 *
 * Session Replay — explicitly NOT enabled. The default 10%/100%
 *   sampling adds ~200KB to the JS bundle, records screen
 *   interactions, and is largely useless for a "do nothing" app where
 *   the user stares at a timer. Re-enable per-incident if a bug
 *   genuinely needs screen context.
 *
 * `tracesSampleRate: 0` — performance tracing off until we have a
 *   budget for the event volume. Free tier's 5k events/month is for
 *   errors first.
 */

let inited = false;

function readDsn(): string | undefined {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    return process.env.EXPO_PUBLIC_SENTRY_DSN;
  }
  const extra = Constants.expoConfig?.extra as
    | { sentryDsn?: string }
    | undefined;
  return extra?.sentryDsn;
}

export function initSentry(): void {
  if (inited) return;
  const dsn = readDsn();
  if (!dsn) {
    if (__DEV__) {
      console.warn(
        '[sentry] DSN not configured — set EXPO_PUBLIC_SENTRY_DSN to enable crash reporting',
      );
    }
    return;
  }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    debug: __DEV__,
    // Captures console.log/warn/error as breadcrumbs on each event —
    // gives the issue page useful context without enabling full logs.
    enableLogs: true,
  });
  inited = true;
}

/**
 * Forward a captured render-time error from `<ErrorBoundary>`.
 * Attaches the React component stack so Sentry's issue page shows
 * which subtree threw, not just the JS frames.
 */
export function captureError(error: Error, info?: ErrorInfo): void {
  if (!inited) return;
  Sentry.captureException(error, {
    contexts: {
      react: { componentStack: info?.componentStack ?? null },
    },
  });
}

/**
 * HOC wrapper for the root component. Enables Sentry's automatic
 * touch-event breadcrumbs + navigation tracing. Re-exported here so
 * the layout doesn't have to import @sentry/react-native directly.
 *
 * No-op when Sentry isn't initialised — `Sentry.wrap` just returns the
 * component if init didn't run, so safe to use unconditionally.
 */
export const wrap = Sentry.wrap;
