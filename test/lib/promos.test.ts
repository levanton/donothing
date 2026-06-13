import {
  PROMOS,
  computeDiscountPct,
  resolvePromoCopy,
  type PromoCopy,
} from '@/lib/promos';

describe('computeDiscountPct', () => {
  it('computes a rounded percent off from full vs offer price', () => {
    expect(computeDiscountPct(100, 50)).toBe(50);
    expect(computeDiscountPct(49.99, 24.99)).toBe(50);
    expect(computeDiscountPct(60, 40)).toBe(33);
  });

  it('returns undefined for missing or non-positive inputs', () => {
    expect(computeDiscountPct(undefined, 50)).toBeUndefined();
    expect(computeDiscountPct(100, undefined)).toBeUndefined();
    expect(computeDiscountPct(0, 0)).toBeUndefined();
  });

  it('returns undefined when there is no actual discount', () => {
    // offer >= full → 0% or negative, which we never advertise.
    expect(computeDiscountPct(50, 50)).toBeUndefined();
    expect(computeDiscountPct(50, 60)).toBeUndefined();
  });
});

describe('resolvePromoCopy', () => {
  const copy: PromoCopy = {
    headline: { before: 'next year is ', bold: '{pct}% off', after: '!' },
    bullets: ['a', 'b'],
    cta: { before: 'Try ', bold: 'nothing', after: ' again' },
  };

  it('substitutes {pct} in the headline bold with the real percent', () => {
    const r = resolvePromoCopy(copy, 50);
    expect(r.headline.bold).toBe('50% off');
    expect(r.headline.before).toBe('next year is ');
    expect(r.headline.after).toBe('!');
  });

  it('passes bullets and cta through unchanged', () => {
    const r = resolvePromoCopy(copy, 50);
    expect(r.bullets).toEqual(['a', 'b']);
    expect(r.cta).toEqual({ before: 'Try ', bold: 'nothing', after: ' again' });
  });
});

describe('PROMOS registry', () => {
  it('keeps the returning win-back DISABLED until explicitly switched on', () => {
    const returning = PROMOS.find((p) => p.id === 'winback-returning');
    expect(returning).toBeDefined();
    expect(returning!.enabled).toBe(false);
    expect(returning!.offer).toEqual({
      kind: 'promotional',
      offerId: 'nothing_year_50_off',
    });
    expect(returning!.productId).toBe('nothing_yearly');
    expect(returning!.audience).toBe('returning');
  });

  it('keeps the intro promo enabled for new subscribers on the paywall', () => {
    const intro = PROMOS.find((p) => p.id === 'intro-new');
    expect(intro).toBeDefined();
    expect(intro!.enabled).toBe(true);
    expect(intro!.audience).toBe('new');
    expect(intro!.offer.kind).toBe('intro');
    expect(intro!.surfaces).toContain('paywall');
  });

  it('every promo has unique id and non-empty surfaces', () => {
    const ids = PROMOS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PROMOS) expect(p.surfaces.length).toBeGreaterThan(0);
  });
});
