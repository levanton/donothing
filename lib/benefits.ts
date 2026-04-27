// Benefit copy + icon registry for the post-session screen and any
// other place that surfaces "what your body just got from doing
// nothing". Tier tables live here so the wording, science and icon
// choices stay in one place — adding a new pause-length tier or
// re-skinning the iconography never has to touch SessionCompleteScreen.

import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type BenefitIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface Benefit {
  icon: BenefitIcon;
  title: string;
  sub: string;
}

// Tiers ordered longest-first; pickBenefits walks the list and returns
// the first set the duration crosses. Minimum session is 1 minute, so
// the 60-second floor is the smallest tier we ever surface.
export const BENEFIT_TIERS: Array<{ minSeconds: number; items: Benefit[] }> = [
  {
    minSeconds: 30 * 60,
    items: [
      { icon: 'weather-night',   title: 'deep rest achieved',  sub: 'your brain fully recovered' },
      { icon: 'heart-pulse',     title: 'stress dissolved',    sub: 'cortisol back to baseline' },
      { icon: 'spa-outline',     title: 'emotions settled',    sub: 'amygdala calmed down' },
      { icon: 'lightbulb-on',    title: 'creativity unlocked', sub: 'new neural connections forming' },
      { icon: 'archive-outline', title: 'memory consolidated', sub: "today's experiences organized" },
      { icon: 'eye-outline',     title: 'mind cleared',        sub: 'thinking at full capacity' },
    ],
  },
  {
    minSeconds: 20 * 60,
    items: [
      { icon: 'weather-night',  title: 'deep rest achieved',  sub: 'equivalent to a power nap' },
      { icon: 'heart-pulse',    title: 'stress dissolved',    sub: 'cortisol back to baseline' },
      { icon: 'spa-outline',    title: 'emotions settled',    sub: 'amygdala activity reduced' },
      { icon: 'lightning-bolt', title: 'focus sharpened',     sub: 'deep attention back online' },
      { icon: 'lightbulb-on',   title: 'creativity unlocked', sub: 'new neural connections forming' },
    ],
  },
  {
    minSeconds: 15 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones significantly down' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention back online' },
      { icon: 'compass',        title: 'clearer decisions',    sub: 'working memory clear' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
      { icon: 'lightbulb-on',   title: 'creativity unlocked',  sub: 'new neural connections forming' },
    ],
  },
  {
    minSeconds: 10 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones easing' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention coming back' },
      { icon: 'compass',        title: 'clearer decisions',    sub: 'working memory clear' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
    ],
  },
  {
    minSeconds: 5 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones easing' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention coming back' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
    ],
  },
  {
    minSeconds: 3 * 60,
    items: [
      { icon: 'weather-windy', title: 'your breath slowed',        sub: 'nervous system calming down' },
      { icon: 'heart',         title: 'cortisol started dropping', sub: 'stress hormones easing' },
      { icon: 'eye-outline',   title: 'attention returning',       sub: 'your brain got a breath' },
    ],
  },
  {
    minSeconds: 60,
    items: [
      { icon: 'weather-windy', title: 'your breath slowed', sub: 'nervous system starting to calm' },
      { icon: 'pause-circle',  title: 'the rush stopped',   sub: 'stress loop interrupted' },
    ],
  },
];

export function pickBenefits(seconds: number): Benefit[] {
  for (const tier of BENEFIT_TIERS) {
    if (seconds >= tier.minSeconds) return tier.items;
  }
  return BENEFIT_TIERS[BENEFIT_TIERS.length - 1].items;
}
