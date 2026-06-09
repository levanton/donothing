import * as Haptics from 'expo-haptics';

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
  // A long, warm "swell" played when a session finishes — a gentle ramp up to a
  // peak and a soft fade, in place of an end-of-timer notification. iOS can't do
  // one sustained buzz via expo-haptics, so we sequence closely-spaced impacts.
  celebrate: () => {
    const I = Haptics.ImpactFeedbackStyle;
    const seq: Array<[Haptics.ImpactFeedbackStyle, number]> = [
      [I.Light, 0],
      [I.Light, 110],
      [I.Medium, 220],
      [I.Medium, 330],
      [I.Heavy, 470],
      [I.Medium, 630],
      [I.Light, 800],
      [I.Light, 980],
    ];
    seq.forEach(([style, delay]) => {
      setTimeout(() => {
        Haptics.impactAsync(style).catch(() => {});
      }, delay);
    });
  },
};
