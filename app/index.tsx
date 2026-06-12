import HomeShell from '@/components/home/HomeShell';

// ===========================================================================
// Route file only — the home screen (slide panes, swipe gestures, session
// wiring, overlays) lives in components/home/HomeShell. The shell also owns
// the not-ready terracotta placeholder and the first-launch onboarding
// redirect, because useAppLifecycle inside it kicks off store.init() —
// gating the shell's mount on `ready` here would deadlock startup.
// ===========================================================================
export default function DoNothingScreen() {
  return <HomeShell />;
}
