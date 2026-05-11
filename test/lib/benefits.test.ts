import { BENEFIT_TIERS, pickBenefits } from '@/lib/benefits';

describe('BENEFIT_TIERS', () => {
  it('is ordered longest-first (descending minSeconds)', () => {
    for (let i = 1; i < BENEFIT_TIERS.length; i++) {
      expect(BENEFIT_TIERS[i].minSeconds).toBeLessThan(BENEFIT_TIERS[i - 1].minSeconds);
    }
  });

  it('floors at 60 seconds (the smallest savable session)', () => {
    const last = BENEFIT_TIERS[BENEFIT_TIERS.length - 1];
    expect(last.minSeconds).toBe(60);
    expect(last.items.length).toBeGreaterThan(0);
  });
});

describe('pickBenefits', () => {
  it('returns the longest tier for 30+ minute sessions', () => {
    const items = pickBenefits(45 * 60);
    expect(items).toEqual(BENEFIT_TIERS[0].items);
  });

  it('picks the 15-minute tier just below 20 minutes', () => {
    const tier20 = BENEFIT_TIERS.find((t) => t.minSeconds === 20 * 60)!;
    const tier15 = BENEFIT_TIERS.find((t) => t.minSeconds === 15 * 60)!;
    expect(pickBenefits(20 * 60 - 1)).toBe(tier15.items);
    expect(pickBenefits(20 * 60)).toBe(tier20.items);
  });

  it('falls back to the smallest tier below 60 seconds', () => {
    const fallback = BENEFIT_TIERS[BENEFIT_TIERS.length - 1].items;
    expect(pickBenefits(0)).toBe(fallback);
    expect(pickBenefits(30)).toBe(fallback);
  });

  it('returns the 60s tier exactly at the floor', () => {
    const tier60 = BENEFIT_TIERS[BENEFIT_TIERS.length - 1];
    expect(pickBenefits(60)).toBe(tier60.items);
  });
});
