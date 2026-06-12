import {
  flagsForPhase,
  isSessionSurfaceFree,
  nextPhase,
  type SessionPhase,
} from '@/lib/session-machine';

describe('session-machine', () => {
  it('walks the happy path: arm → begin → complete held → reveal → dismiss', () => {
    let phase: SessionPhase = 'idle';
    for (const [event, expected] of [
      ['ARM', 'arming'],
      ['BEGIN', 'running'],
      ['COMPLETE_HELD', 'holding'],
      ['REVEAL', 'celebrating'],
      ['DISMISS', 'idle'],
    ] as const) {
      const next = nextPhase(phase, event);
      expect(next).toBe(expected);
      phase = next!;
    }
  });

  it('completes straight to celebrating when finished in hand', () => {
    expect(nextPhase('running', 'COMPLETE')).toBe('celebrating');
  });

  it('pause → resume round-trips through paused', () => {
    expect(nextPhase('running', 'PAUSE')).toBe('paused');
    expect(nextPhase('paused', 'RESUME')).toBe('running');
  });

  it('start over re-arms the ritual from paused and running', () => {
    expect(nextPhase('paused', 'START_OVER')).toBe('arming');
    expect(nextPhase('running', 'START_OVER')).toBe('arming');
  });

  it('cancelling the gate goes home without a session', () => {
    expect(nextPhase('arming', 'CANCEL_ARM')).toBe('idle');
  });

  it('rejects illegal events instead of corrupting state', () => {
    // The exact class of bugs the machine exists to kill.
    expect(nextPhase('arming', 'PAUSE')).toBeNull(); // background mid-gate
    expect(nextPhase('running', 'BEGIN')).toBeNull(); // double face-down
    expect(nextPhase('holding', 'PAUSE')).toBeNull(); // lift ≠ pause here
    expect(nextPhase('idle', 'DISMISS')).toBeNull(); // stale tap
    expect(nextPhase('idle', 'COMPLETE')).toBeNull();
    expect(nextPhase('celebrating', 'ARM')).toBeNull(); // no session over celebration
  });

  it('derives the legacy flags consistently for every phase', () => {
    expect(flagsForPhase('idle')).toEqual({
      started: false,
      awaitingFaceDown: false,
      paused: false,
      sessionEndedVisible: false,
      completionHeld: false,
      completionVisible: false,
    });
    expect(flagsForPhase('arming')).toMatchObject({ started: true, awaitingFaceDown: true });
    expect(flagsForPhase('running')).toMatchObject({ started: true, awaitingFaceDown: false, paused: false });
    expect(flagsForPhase('paused')).toMatchObject({ started: true, paused: true, sessionEndedVisible: true });
    expect(flagsForPhase('holding')).toMatchObject({ started: false, completionHeld: true, completionVisible: false });
    expect(flagsForPhase('celebrating')).toMatchObject({ completionHeld: false, completionVisible: true });
  });

  it('only the idle surface is free for overlays (block sheet etc.)', () => {
    const phases: SessionPhase[] = ['idle', 'arming', 'running', 'paused', 'holding', 'celebrating'];
    expect(phases.filter(isSessionSurfaceFree)).toEqual(['idle']);
  });
});
