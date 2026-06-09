import { useEffect, useRef } from 'react';
import { useCopilot } from 'react-native-copilot';
import { useAppStore } from '@/lib/store';
import { getStepDef, type TutorialScreen } from '@/lib/tutorial/steps';

interface Props {
  // Open / close the home-screen panels so the next step's target is
  // mounted and laid out before copilot tries to measure it.
  showHome: () => void;
  showSettings: () => void;
  showHistory: () => void;
  // Settle delay matching the existing 400ms slide animation so the
  // spotlight doesn't fire on a half-measured rect.
  settleMs?: number;
}

// Lives inside the home screen (so it can drive the slide animations)
// while still under <CopilotProvider> from the root layout. Watches
// copilot events and the `tutorialPending` store flag to:
//   1) start the tour when the home "how it works" button sets it pending
//   2) open the right panel for each step's `screen`
//   3) mark the tour complete + close panels on stop/finish
export function TutorialController({ showHome, showSettings, showHistory, settleMs = 450 }: Props) {
  const { start, stop, copilotEvents, currentStep } = useCopilot();
  const tutorialPending = useAppStore((s) => s.tutorialPending);
  const ready = useAppStore((s) => s.ready);
  const setTutorialCompleted = useAppStore((s) => s.setTutorialCompleted);
  const setTutorialPending = useAppStore((s) => s.setTutorialPending);

  const lastScreenRef = useRef<TutorialScreen | null>(null);
  const startedRef = useRef(false);

  // Keep copilot's `start` and the pending-setter in refs. Both change
  // identity as CopilotSteps register on mount; if they were in the effect
  // deps below, that churn would re-run the effect and clear the scheduled
  // `start()` timer before it ever fires — which is exactly why the tour
  // silently never appeared. Reading them off a ref decouples scheduling
  // from that churn. (start() itself retries internally until steps exist.)
  const startRef = useRef(start);
  startRef.current = start;
  const setTutorialPendingRef = useRef(setTutorialPending);
  setTutorialPendingRef.current = setTutorialPending;

  // The tour never auto-shows. It starts only when the user taps the
  // "how it works" button on the home screen, which sets `tutorialPending`.
  // Clears the flag only inside the timer (after start) so the synchronous
  // state change can't cancel its own start. The 400ms delay lets the home
  // settle so copilot measures the first target cleanly.
  useEffect(() => {
    if (!ready || !tutorialPending) return;
    startedRef.current = true;
    lastScreenRef.current = null;
    const t = setTimeout(() => {
      void startRef.current();
      setTutorialPendingRef.current(false);
    }, 400);
    return () => clearTimeout(t);
  }, [ready, tutorialPending]);

  // Drive the panels based on current step's screen.
  useEffect(() => {
    const def = getStepDef(currentStep?.name);
    if (!def) return;
    if (lastScreenRef.current === def.screen) return;
    const prev = lastScreenRef.current;
    lastScreenRef.current = def.screen;

    // Transitioning between panels — close the old one first only when
    // moving back to home; sheets stack visually otherwise.
    if (def.screen === 'home') showHome();
    if (def.screen === 'settings') {
      if (prev === 'history') showHome();
      showSettings();
    }
    if (def.screen === 'history') {
      // History panel slides up over the home; settings panel needs to
      // be dismissed first so the spotlight isn't behind it.
      showHome();
      setTimeout(() => showHistory(), settleMs);
    }
  }, [currentStep?.name, showHome, showSettings, showHistory, settleMs]);

  // Cleanup + persistence on stop or finish.
  useEffect(() => {
    const onStop = () => {
      lastScreenRef.current = null;
      startedRef.current = false;
      showHome();
      setTutorialCompleted();
    };
    copilotEvents.on('stop', onStop);
    return () => {
      copilotEvents.off('stop', onStop);
    };
  }, [copilotEvents, showHome, setTutorialCompleted]);

  // If the user wipes data and re-runs onboarding mid-session, make sure
  // a stale tour gets dismissed cleanly when this controller unmounts.
  //
  // CRITICAL: empty deps + a ref for `stop`. copilot's `stop` identity
  // changes the instant the tour becomes visible (it closes over the new
  // visible/currentStep state). If `stop` were in the deps, this effect's
  // cleanup would re-run on that change and immediately stop the tour we
  // just started — the "flash and vanish" bug. Empty deps mean the cleanup
  // only fires on a real unmount.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    return () => {
      if (startedRef.current) void stopRef.current();
    };
  }, []);

  return null;
}
