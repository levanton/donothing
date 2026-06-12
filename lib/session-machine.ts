/**
 * The session lifecycle — ONE explicit state machine.
 *
 * Every screen, sheet and sensor used to derive its behaviour from ad-hoc
 * combinations of booleans (`started`, `paused`, `awaitingFaceDown`,
 * `completionHeld`, …) scattered across the store, app/index.tsx and the
 * lifecycle hooks. Fixing one path kept breaking another. This file is now
 * the single source of truth: the phases, the legal transitions between
 * them, and the mapping from a phase to the legacy flags the UI reads.
 *
 *                ARM            BEGIN (face-down / fallback tap)
 *      ┌──────┐ ────► ┌────────┐ ────► ┌─────────┐
 *      │ idle │       │ arming │       │ running │
 *      └──────┘ ◄──── └────────┘       └─────────┘
 *         ▲    CANCEL_ARM │ ▲             │  │ COMPLETE_HELD (face down)
 *         │               │ │ START_OVER  │  ▼
 *         │               │ │ (re-arm)    │ ┌─────────┐  REVEAL ┌─────────────┐
 *         │               ▼ │      PAUSE  │ │ holding │ ──────► │ celebrating │
 *         │              ┌────────┐ ◄─────┘ └─────────┘ (lift)  └─────────────┘
 *         │ END          │ paused │                 COMPLETE (in hand) ──► ▲
 *         ├───────◄───── └────────┘ ── RESUME (flip back) ──► running      │
 *         │                                                                │
 *         └──────────────────◄──── DISMISS ────────────────────────────────┘
 *
 * Phases:
 *  - idle         home screen, no session.
 *  - arming       the gate: "place your phone face down". Clock NOT running.
 *  - running      the clock ticks (entered only via BEGIN — the ritual).
 *  - paused       interrupt sheet (lift / pause / backgrounding).
 *  - holding      countdown hit 00:00 while face down — celebration waits
 *                 for the pick-up gesture.
 *  - celebrating  the completion screens are visible.
 *
 * Hard invariant: the ONLY transitions that start the clock are BEGIN and
 * RESUME — both driven by the face-down ritual (or its explicit fallback
 * taps). Nothing else may create a timer.
 */

export type SessionPhase =
  | 'idle'
  | 'arming'
  | 'running'
  | 'paused'
  | 'holding'
  | 'celebrating';

export type SessionEvent =
  | 'ARM'
  | 'BEGIN'
  | 'CANCEL_ARM'
  | 'PAUSE'
  | 'RESUME'
  | 'START_OVER'
  | 'END'
  | 'COMPLETE'
  | 'COMPLETE_HELD'
  | 'REVEAL'
  | 'DISMISS';

const TRANSITIONS: Record<SessionPhase, Partial<Record<SessionEvent, SessionPhase>>> = {
  idle: {
    ARM: 'arming',
  },
  arming: {
    BEGIN: 'running',
    CANCEL_ARM: 'idle',
    END: 'idle',
  },
  running: {
    PAUSE: 'paused',
    COMPLETE: 'celebrating',
    COMPLETE_HELD: 'holding',
    START_OVER: 'arming',
    END: 'idle',
  },
  paused: {
    RESUME: 'running',
    START_OVER: 'arming',
    END: 'idle',
  },
  holding: {
    REVEAL: 'celebrating',
    END: 'idle',
  },
  celebrating: {
    DISMISS: 'idle',
  },
};

/** The next phase, or null when the event is illegal in this phase —
 *  callers must treat null as "ignore quietly" (e.g. a stale tap). */
export function nextPhase(phase: SessionPhase, event: SessionEvent): SessionPhase | null {
  return TRANSITIONS[phase][event] ?? null;
}

/**
 * Legacy view of a phase. The UI still reads these flags; they are now
 * DERIVED in one place and written atomically together with the phase, so
 * they can never disagree with each other again.
 */
export function flagsForPhase(phase: SessionPhase): {
  started: boolean;
  awaitingFaceDown: boolean;
  paused: boolean;
  sessionEndedVisible: boolean;
  completionHeld: boolean;
  completionVisible: boolean;
} {
  return {
    started: phase === 'arming' || phase === 'running' || phase === 'paused',
    awaitingFaceDown: phase === 'arming',
    paused: phase === 'paused',
    sessionEndedVisible: phase === 'paused',
    completionHeld: phase === 'holding',
    completionVisible: phase === 'celebrating',
  };
}

/** Can anything ELSE (the block-unlock sheet, banners, tours) take over the
 *  screen right now? Exactly one rule, used by every surfacer. */
export function isSessionSurfaceFree(phase: SessionPhase): boolean {
  return phase === 'idle';
}
