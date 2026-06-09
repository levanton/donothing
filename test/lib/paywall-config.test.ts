import {
  RC_PACKAGE_BY_PLAN,
  WINBACK_PRODUCT_ID,
  ctaLabel,
  type PackagesByPlan,
} from '@/lib/paywall-config';

function pkg(priceString: string): any {
  return { product: { priceString } };
}

describe('RC identifiers', () => {
  it('maps each plan to a non-empty list of RC identifiers', () => {
    expect(RC_PACKAGE_BY_PLAN.monthly).toContain('$rc_monthly');
    expect(RC_PACKAGE_BY_PLAN.yearly).toContain('$rc_annual');
    expect(RC_PACKAGE_BY_PLAN.lifetime).toContain('$rc_lifetime');
  });

  it('keeps the win-back product ID stable', () => {
    expect(WINBACK_PRODUCT_ID).toBe('yearly_40_discount');
  });
});

describe('ctaLabel', () => {
  const packages: PackagesByPlan = {
    monthly: pkg('$3.99'),
    lifetime: pkg('$49.99'),
  };

  it('monthly uses the localized price suffix', () => {
    expect(ctaLabel('monthly', packages)).toBe('Subscribe — $3.99/mo');
  });

  it('monthly falls back to "Subscribe" when no price', () => {
    expect(ctaLabel('monthly', {})).toBe('Subscribe');
  });

  it('yearly is always the free-trial CTA', () => {
    expect(ctaLabel('yearly', packages)).toBe('Try Free for 3 Days');
    expect(ctaLabel('yearly', {})).toBe('Try Free for 3 Days');
  });

  it('lifetime uses the price when available, fallback otherwise', () => {
    expect(ctaLabel('lifetime', packages)).toBe('Get Lifetime — $49.99');
    expect(ctaLabel('lifetime', {})).toBe('Get Lifetime');
  });
});
