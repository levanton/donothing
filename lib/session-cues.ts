import torch from 'torch';

import { haptics } from '@/lib/haptics';
import { sound } from '@/lib/sound';

// Shared sensory cues for a "do nothing" minute — the felt, heard, and
// seen signals that mark it beginning, resuming, and ending. One source
// of truth so the onboarding rehearsal and the real session always feel
// identical, and so a change to "how a start feels" lands everywhere at
// once. All three no-op gracefully without the matching hardware.

// "It has begun" — a haptic pulse, the start chime (heard even on silent,
// so a disabled-vibration setting can't make the start go unnoticed), and
// a brief candle-glow off the torch that bookends the end-of-session
// light. Fires at the true start of a minute.
export function cueSessionStart(): void {
  haptics.begin();
  sound.start();
  void torch.blink(1, 0.1, 220, 0);
}

// Resuming after a lift — the clock picking back up is a start too, so it
// gets the full "it has begun" cue: pulse, chime, and the same brief
// candle-glow off the torch.
export function cueSessionResume(): void {
  haptics.begin();
  sound.start();
  void torch.blink(1, 0.1, 220, 0);
}

// End of the minute — felt, heard, and seen: the closing haptic, the soft
// completion chime, and the torch breathing light up off the table so the
// end is visible across the room, not just audible. The haptic differs by
// context — the real session's quiet `success` vs. the onboarding's richer
// `celebrate` swell — so the caller picks which (defaults to celebrate).
export function cueSessionComplete(haptic: 'success' | 'celebrate' = 'celebrate'): void {
  haptics[haptic]();
  sound.complete();
  void torch.blink();
}
