/**
 * lib/sentry.ts has a module-scoped `inited` flag — load fresh via
 * `jest.isolateModules` per test so initSentry() doesn't leak across
 * cases.
 */

type SentryModule = typeof import('@/lib/sentry');

function loadSentry(): SentryModule {
  let mod: SentryModule;
  jest.isolateModules(() => {
    mod = require('@/lib/sentry');
  });
  return mod!;
}

function rcSentry() {
  return require('@sentry/react-native');
}

const ORIGINAL_DSN_ENV = process.env.EXPO_PUBLIC_SENTRY_DSN;
const ORIGINAL_DEV = (global as { __DEV__?: boolean }).__DEV__;

function setDev(value: boolean) {
  (global as { __DEV__?: boolean }).__DEV__ = value;
}

beforeEach(() => {
  rcSentry().init.mockReset();
  rcSentry().captureException.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // Sentry only initialises in production builds, so the default for
  // these tests is __DEV__ = false. The dev-disable case flips it.
  setDev(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  setDev(ORIGINAL_DEV ?? false);
  if (ORIGINAL_DSN_ENV === undefined) {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  } else {
    process.env.EXPO_PUBLIC_SENTRY_DSN = ORIGINAL_DSN_ENV;
  }
});

describe('initSentry', () => {
  it('skips Sentry.init when no DSN is configured', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { initSentry } = loadSentry();
    initSentry();
    expect(rcSentry().init).not.toHaveBeenCalled();
  });

  it('is disabled entirely in __DEV__, even with a DSN set', () => {
    setDev(true);
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry } = loadSentry();
    initSentry();
    expect(rcSentry().init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with the env DSN', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry } = loadSentry();
    initSentry();
    expect(rcSentry().init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://example@sentry.io/1' }),
    );
  });

  it('init config locks down PII and disables Session Replay', () => {
    // Regression guard: wizard re-runs love to flip sendDefaultPii to
    // true and add replays. If they sneak back in we want a red test
    // (and a privacy-label conversation) before they reach the store.
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry } = loadSentry();
    initSentry();
    const config = rcSentry().init.mock.calls[0][0];
    expect(config.sendDefaultPii).toBe(false);
    expect(config.replaysSessionSampleRate).toBeUndefined();
    expect(config.replaysOnErrorSampleRate).toBeUndefined();
    expect(config.integrations).toBeUndefined();
  });

  it('is idempotent — second call is a no-op', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry } = loadSentry();
    initSentry();
    initSentry();
    expect(rcSentry().init).toHaveBeenCalledTimes(1);
  });
});

describe('captureError', () => {
  it('does nothing when Sentry has not been initialised', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const { captureError } = loadSentry();
    captureError(new Error('boom'));
    expect(rcSentry().captureException).not.toHaveBeenCalled();
  });

  it('forwards the error and the component stack when initialised', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry, captureError } = loadSentry();
    initSentry();
    const err = new Error('render fail');
    captureError(err, { componentStack: '\n  in Foo\n  in Bar' } as any);
    expect(rcSentry().captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        contexts: expect.objectContaining({
          react: expect.objectContaining({
            componentStack: '\n  in Foo\n  in Bar',
          }),
        }),
      }),
    );
  });

  it('tolerates a missing info argument', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
    const { initSentry, captureError } = loadSentry();
    initSentry();
    captureError(new Error('boom'));
    expect(rcSentry().captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: { react: { componentStack: null } },
      }),
    );
  });
});
