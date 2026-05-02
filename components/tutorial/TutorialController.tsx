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
//   1) auto-start the tour after onboarding finishes
//   2) open the right panel for each step's `screen`
//   3) mark the tour complete + close panels on stop/finish
export function TutorialController({ showHome, showSettings, showHistory, settleMs = 450 }: Props) {
  const { start, stop, copilotEvents, currentStep } = useCopilot();
  const tutorialPending = useAppStore((s) => s.tutorialPending);
  const tutorialCompleted = useAppStore((s) => s.tutorialCompleted);
  const ready = useAppStore((s) => s.ready);
  const setTutorialCompleted = useAppStore((s) => s.setTutorialCompleted);

  const lastScreenRef = useRef<TutorialScreen | null>(null);
  const startedRef = useRef(false);

  // Auto-start once the home screen is fully ready and onboarding has
  // marked the tour as pending. Guard against double-start on re-render.
  useEffect(() => {
    if (!ready || tutorialCompleted || !tutorialPending || startedRef.current) return;
    startedRef.current = true;
    // Small delay so the home screen settles before we measure the first target.
    const t = setTimeout(() => { void start(); }, 300);
    return () => clearTimeout(t);
  }, [ready, tutorialCompleted, tutorialPending, start]);

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
  // a stale tour gets dismissed cleanly.
  useEffect(() => {
    return () => {
      if (startedRef.current) void stop();
    };
  }, [stop]);

  return null;
}
