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
    text: 'set how long you want to sit, then tap yes — and do nothing',
  },
  {
    name: 'home.week',
    order: 2,
    screen: 'home',
    text: 'your week of stillness — and your full history is one swipe down',
  },
  {
    name: 'home.settings',
    order: 3,
    screen: 'home',
    text: 'settings live here',
  },
  {
    name: 'settings.block',
    order: 4,
    screen: 'settings',
    text: 'schedule a screen block — pick a time and a duration',
  },
  {
    name: 'settings.allowed',
    order: 5,
    screen: 'settings',
    text: "pick the apps that stay open while you're blocked",
  },
] as const;

export const TUTORIAL_TOTAL_STEPS = TUTORIAL_STEPS.length;

export function getStepDef(name: string | undefined): TutorialStepDef | undefined {
  if (!name) return undefined;
  return TUTORIAL_STEPS.find((s) => s.name === name);
}
