/**
 * Haptics are thin wrappers around expo-haptics that swallow
 * rejections — these tests verify the wrappers (a) call the right
 * underlying API and (b) don't propagate errors when the native
 * module fails (devices with haptics disabled).
 */

import * as Haptics from 'expo-haptics';
import { haptics } from '@/lib/haptics';

beforeEach(() => {
  (Haptics.selectionAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  (Haptics.impactAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  (Haptics.notificationAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('haptics', () => {
  it('select → expo selectionAsync', async () => {
    await haptics.select();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['light', 'medium', 'heavy'] as const)(
    '%s → expo impactAsync with matching style',
    async (key) => {
      await haptics[key]();
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle[key.charAt(0).toUpperCase() + key.slice(1) as 'Light' | 'Medium' | 'Heavy'],
      );
    },
  );

  it.each(['success', 'warning', 'error'] as const)(
    '%s → expo notificationAsync with matching type',
    async (key) => {
      await haptics[key]();
      expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    },
  );

  it('swallows rejections from selectionAsync', async () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error('disabled'));
    await expect(haptics.select()).resolves.toBeUndefined();
  });

  it('swallows rejections from impactAsync', async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('disabled'));
    await expect(haptics.medium()).resolves.toBeUndefined();
  });

  it('swallows rejections from notificationAsync', async () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('disabled'));
    await expect(haptics.success()).resolves.toBeUndefined();
  });
});
