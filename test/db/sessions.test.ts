import { loadDbModules, resetDbState } from './helpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => {
  resetDbState();
  // addSession / updateSessionMood log a warning when input fails Zod
  // parsing. We silence per-test via jest.spyOn; restoreAllMocks
  // guarantees the spy is dropped even if a beforeEach throws.
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('addSession', () => {
  it('inserts a session with a UUID and current timestamp', () => {
    const { sessions } = loadDbModules();
    const before = Date.now();
    const s = sessions.addSession(120);
    const after = Date.now();
    expect(s).not.toBeNull();
    expect(s!.id).toMatch(UUID_RE);
    expect(s!.duration).toBe(120);
    expect(s!.timestamp).toBeGreaterThanOrEqual(before);
    expect(s!.timestamp).toBeLessThanOrEqual(after);
  });

  it('rejects sub-minute durations via the Zod schema', () => {
    const { sessions } = loadDbModules();
    const result = sessions.addSession(30);
    expect(result).toBeNull();
    expect(sessions.getSessionCount()).toBe(0);
  });

  it('rejects durations longer than the daily cap', () => {
    const { sessions } = loadDbModules();
    expect(sessions.addSession(25 * 60 * 60)).toBeNull();
    expect(sessions.getSessionCount()).toBe(0);
  });

  it('rejects non-integer durations', () => {
    const { sessions } = loadDbModules();
    expect(sessions.addSession(60.5)).toBeNull();
  });
});

describe('aggregations', () => {
  it('getTotalDuration sums every row', () => {
    const { sessions } = loadDbModules();
    sessions.addSession(60);
    sessions.addSession(120);
    sessions.addSession(180);
    expect(sessions.getTotalDuration()).toBe(360);
  });

  it('getSessionCount counts rows', () => {
    const { sessions } = loadDbModules();
    sessions.addSession(60);
    sessions.addSession(60);
    expect(sessions.getSessionCount()).toBe(2);
  });

  it('getLongestSessionDuration returns the max', () => {
    const { sessions } = loadDbModules();
    sessions.addSession(60);
    sessions.addSession(900);
    sessions.addSession(300);
    expect(sessions.getLongestSessionDuration()).toBe(900);
  });

  it('returns zeros on an empty table', () => {
    const { sessions } = loadDbModules();
    expect(sessions.getSessionCount()).toBe(0);
    expect(sessions.getTotalDuration()).toBe(0);
    expect(sessions.getLongestSessionDuration()).toBe(0);
    expect(sessions.getActiveDaysCount()).toBe(0);
  });
});

describe('updateSessionMood', () => {
  it('persists a valid mood', () => {
    const { sessions } = loadDbModules();
    const s = sessions.addSession(120)!;
    sessions.updateSessionMood(s.id, 'lighter');
    const all = sessions.getAllSessions();
    expect(all.find((r) => r.id === s.id)?.mood).toBe('lighter');
  });

  it('ignores invalid mood values', () => {
    const { sessions } = loadDbModules();
    const s = sessions.addSession(120)!;
    sessions.updateSessionMood(s.id, 'happy' as any);
    const all = sessions.getAllSessions();
    expect(all.find((r) => r.id === s.id)?.mood).toBeUndefined();
  });
});

describe('deletes', () => {
  it('deleteSessionById removes the row', () => {
    const { sessions } = loadDbModules();
    const a = sessions.addSession(60)!;
    sessions.addSession(120);
    sessions.deleteSessionById(a.id);
    expect(sessions.getSessionCount()).toBe(1);
  });
});

describe('cleanupInvalidSessions', () => {
  it('keeps in-bounds rows', () => {
    const { sessions } = loadDbModules();
    sessions.addSession(60);
    sessions.addSession(3600);
    expect(sessions.cleanupInvalidSessions()).toBe(0);
  });
});

describe('getMonthSessionCount / getMonthLongestSession', () => {
  it('reports zero when the table is empty', () => {
    const { sessions } = loadDbModules();
    const now = new Date();
    expect(sessions.getMonthSessionCount(now.getFullYear(), now.getMonth() + 1)).toBe(0);
    expect(sessions.getMonthLongestSession(now.getFullYear(), now.getMonth() + 1)).toBe(0);
  });

  it('counts and maxes rows in the current month', () => {
    const { sessions } = loadDbModules();
    sessions.addSession(60);
    sessions.addSession(900);
    const now = new Date();
    expect(sessions.getMonthSessionCount(now.getFullYear(), now.getMonth() + 1)).toBe(2);
    expect(sessions.getMonthLongestSession(now.getFullYear(), now.getMonth() + 1)).toBe(900);
  });
});
