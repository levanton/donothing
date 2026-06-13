import {
  RC_PACKAGE_BY_PLAN,
  WINBACK_PRODUCT_ID,
  ctaLabel,
  freeTrialDays,
  annualAnchorPrice,
  type PackagesByPlan,
} from '@/lib/paywall-config';

function pkg(priceString: string, price = 0, introPrice: any = null): any {
  return { product: { priceString, price, introPrice } };
}

// A FREE intro offer (price 0) of the given period — matches what RC reports
// for an App Store Connect free trial.
function freeTrial(periodUnit: string, periodNumberOfUnits: number, cycles = 1): any {
  return { price: 0, priceString: 'Free', cycles, period: '', periodUnit, periodNumberOfUnits };
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
    monthly: pkg('$3.99', 3.99),
    yearly: pkg('$29.99', 29.99, freeTrial('DAY', 3)),
    lifetime: pkg('$49.99', 49.99),
  };

  it('monthly uses the localized price suffix', () => {
    expect(ctaLabel('monthly', packages)).toBe('Subscribe — $3.99/mo');
  });

  it('monthly falls back to "Subscribe" when no price', () => {
    expect(ctaLabel('monthly', {})).toBe('Subscribe');
  });

  it('yearly shows the free-trial CTA derived from the real intro offer', () => {
    expect(ctaLabel('yearly', packages)).toBe('Try Free for 3 Days');
  });

  it('yearly falls back to a price CTA when the product has no free trial', () => {
    expect(ctaLabel('yearly', { yearly: pkg('$29.99', 29.99) })).toBe(
      'Subscribe — $29.99/yr',
    );
    expect(ctaLabel('yearly', {})).toBe('Subscribe');
  });

  it('lifetime uses the price when available, fallback otherwise', () => {
    expect(ctaLabel('lifetime', packages)).toBe('Get Lifetime — $49.99');
    expect(ctaLabel('lifetime', {})).toBe('Get Lifetime');
  });
});

describe('freeTrialDays', () => {
  it('returns the day count for a free day-unit trial', () => {
    expect(freeTrialDays(pkg('$29.99', 29.99, freeTrial('DAY', 3)))).toBe(3);
  });

  it('normalizes week units to days', () => {
    expect(freeTrialDays(pkg('$29.99', 29.99, freeTrial('WEEK', 1)))).toBe(7);
  });

  it('returns null when there is no intro offer', () => {
    expect(freeTrialDays(pkg('$29.99', 29.99))).toBeNull();
    expect(freeTrialDays(undefined)).toBeNull();
  });

  it('returns null for a PAID intro offer (a discount, not a free trial)', () => {
    const paid = {
      price: 9.99,
      priceString: '$9.99',
      cycles: 1,
      period: '',
      periodUnit: 'MONTH',
      periodNumberOfUnits: 1,
    };
    expect(freeTrialDays(pkg('$29.99', 29.99, paid))).toBeNull();
  });
});

describe('annualAnchorPrice', () => {
  it('shows monthly×12 struck through when pricier than the annual plan', () => {
    expect(annualAnchorPrice(pkg('$3.99', 3.99), pkg('$29.99', 29.99))).toBe(
      '$47.88',
    );
  });

  it('matches the locale formatting of the monthly price string', () => {
    expect(annualAnchorPrice(pkg('3,99 €', 3.99), pkg('29,99 €', 29.99))).toBe(
      '47,88 €',
    );
  });

  it('hides when annualized monthly is not more than the annual price', () => {
    expect(annualAnchorPrice(pkg('$3.99', 3.99), pkg('$60.00', 60))).toBeUndefined();
  });

  it('hides when there is no monthly plan to compare against', () => {
    expect(annualAnchorPrice(undefined, pkg('$29.99', 29.99))).toBeUndefined();
  });
});
