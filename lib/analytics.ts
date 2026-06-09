import PostHog from 'posthog-react-native';

/**
 * Single seam for product analytics (PostHog). Everything else talks to
 * `initAnalytics()` / `track()` / `identifyUser()` / `resetAnalytics()` so the
 * SDK stays off the public surface — same pattern as lib/sentry.ts.
 *
 * Key resolution: `EXPO_PUBLIC_POSTHOG_KEY` (build-time inlined by Expo). The
 * PostHog project key is a write-only public token — safe to ship in the app.
 * Without a key every function no-ops silently, so builds without analytics
 * configured don't crash.
 *
 * --- Privacy / cost choices (wellness app, EU cloud) ---
 *  - `personProfiles: 'identified_only'` — never create a person profile for
 *    anonymous users (there are no accounts). Events are still captured
 *    anonymously by distinct_id, so funnels/retention work, but we don't build
 *    identified profiles unless we ever call identifyUser().
 *  - `enableSessionReplay: false` — no screen recording. Adds bundle weight and
 *    is a privacy red flag for a "do nothing" app where the user stares at a
 *    timer.
 *  - Every event is tagged with an `environment` super property so dev sessions
 *    can be filtered out of production dashboards.
 */

let client: PostHog | null = null;

export function initAnalytics(): void {
  if (client) return;
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    personProfiles: 'identified_only',
    captureAppLifecycleEvents: true,
    enableSessionReplay: false,
  });
  // Persisted super property on every event — lets dashboards exclude dev data.
  void client.register({ environment: __DEV__ ? 'development' : 'production' });
}

// PostHog's property maps only accept JSON values; cast our ergonomic
// Record<string, unknown> callers to the SDK's exact param type at the seam.
type EventProps = Parameters<PostHog['capture']>[1];

/** Capture a product event. No-ops until initAnalytics() has run with a key. */
export function track(event: string, properties?: Record<string, unknown>): void {
  client?.capture(event, properties as EventProps);
}

/**
 * Persist properties onto every future event (PostHog super properties).
 * Used for the onboarding quiz answers so the whole funnel can be segmented
 * by pain point / screen-time band / age band.
 */
export function registerProps(properties: Record<string, unknown>): void {
  void client?.register(properties as Parameters<PostHog['register']>[0]);
}

/** Attach the anonymous events so far to a stable id (only if we ever add accounts). */
export function identifyUser(distinctId: string, properties?: Record<string, unknown>): void {
  client?.identify(distinctId, properties as EventProps);
}

/** Clear the distinct id (e.g. on account deletion / sign-out). */
export function resetAnalytics(): void {
  client?.reset();
}
