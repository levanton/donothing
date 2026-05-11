import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ErrorInfo } from 'react';

/**
 * Single seam for Sentry. Everywhere else in the app talks to
 * `initSentry()` / `captureError()` — keeps the SDK off the public
 * surface so swapping crash reporters later is one file.
 *
 * DSN resolution (first match wins):
 *   1. `EXPO_PUBLIC_SENTRY_DSN` env var (build-time inlined by Expo)
 *   2. `expoConfig.extra.sentryDsn` from app.json
 *
 * If no DSN is configured we no-op silently in production and warn
 * once in __DEV__ so a forgotten setup is loud during dev but doesn't
 * crash builds where Sentry isn't wanted (e.g. local debug runs).
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
    // Performance tracing off by default — turn on once we have a
    // budget for the volume. The free tier's 5k events/month is for
    // errors first.
    tracesSampleRate: 0,
    // Don't ship debug logs from the SDK to the user's console in
    // release builds.
    debug: __DEV__,
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
