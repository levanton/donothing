import * as Haptics from 'expo-haptics';
import * as CoreHaptics from 'core-haptics';

/**
 * Thin wrapper around expo-haptics that swallows errors instead of
 * letting unhandled promise rejections escape — haptics fail silently
 * on unsupported devices / when the system disables them, and we
 * never want UI flow blocked on a missing buzz.
 */
export const haptics = {
  select: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  // A long, smooth "swell" played when a session finishes — in place of an
  // end-of-timer notification.
  //
  // The real deal (Opal-style) is one *continuous* Core Haptics vibration whose
  // amplitude swells and fades — see modules/core-haptics. expo-haptics can't do
  // that (discrete impacts only), so when the native module isn't available
  // (Expo Go, or before the next native build) we fall back to densely
  // sequenced SOFT impacts that approximate a wave.
  celebrate: () => {
    if (CoreHaptics.isSupported()) {
      CoreHaptics.playSwell();
      return;
    }
    const I = Haptics.ImpactFeedbackStyle;
    // Fallback: tight ~50ms spacing so the taps blur into one buzz, with the
    // intensity stepped gradually (Soft→Light→Medium and back) — no Soft↔Heavy
    // jumps — so it reads as a swell instead of separate knocks.
    const seq: Array<[Haptics.ImpactFeedbackStyle, number]> = [
      [I.Soft, 0],
      [I.Soft, 50],
      [I.Light, 100],
      [I.Light, 150],
      [I.Light, 200],
      [I.Medium, 250],
      [I.Medium, 300],
      [I.Medium, 350],
      [I.Medium, 400],
      [I.Medium, 450],
      [I.Medium, 500],
      [I.Medium, 550],
      [I.Light, 605],
      [I.Light, 660],
      [I.Soft, 720],
      [I.Soft, 785],
      [I.Soft, 860],
      [I.Soft, 950],
      [I.Soft, 1060],
    ];
    seq.forEach(([style, delay]) => {
      setTimeout(() => {
        Haptics.impactAsync(style).catch(() => {});
      }, delay);
    });
  },
};
