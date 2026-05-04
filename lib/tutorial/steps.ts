// Single source of truth for the first-launch spotlight tour.
// Each step targets one element via <CopilotStep name=... order=... text=...>.
// `screen` drives the bottom-sheet sync in app/index.tsx so the right
// surface is open when the spotlight tries to measure its target.

export type TutorialScreen = 'home' | 'settings' | 'history';

export interface TutorialStepDef {
  name: string;
  order: number;
  screen: TutorialScreen;
  text: string;
}

export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
  {
    name: 'home.timer',
    order: 1,
    screen: 'home',
    text: 'set a duration and tap yes — a moment of stillness, any time, no blocks required',
  },
  {
    name: 'home.journey',
    order: 2,
    screen: 'home',
    text: 'swipe down to see your full history of stillness',
  },
  {
    name: 'home.settings',
    order: 3,
    screen: 'home',
    text: 'tap here to schedule screen blocks, pick apps that stay allowed, and manage your account',
  },
] as const;

export const TUTORIAL_TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepDef(name: string | undefined): TutorialStepDef | undefined {
  if (!name) return undefined;
  return TUTORIAL_STEPS.find((s) => s.name === name);
}
