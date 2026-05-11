/**
 * subscription.ts wraps react-native-purchases with a single-tier
 * status model. Tests load the module via `jest.isolateModules` per
 * test so the internal `configured` flag resets between cases.
 *
 * The shape of CustomerInfo here is the minimum the status reducer
 * reads — `entitlements.active` and `activeSubscriptions`.
 */

import type { CustomerInfo } from 'react-native-purchases';

type Sub = typeof import('@/lib/subscription');

function loadModule(): Sub {
  let mod: Sub;
  jest.isolateModules(() => {
    mod = require('@/lib/subscription');
  });
  return mod!;
}

function customerInfo(
  active: Record<string, unknown>,
  activeSubscriptions: string[] = [],
): CustomerInfo {
  return {
    entitlements: { active },
    activeSubscriptions,
  } as unknown as CustomerInfo;
}

function rc() {
  return require('react-native-purchases').default;
}

beforeEach(() => {
  const Purchases = rc();
  // mockReset wipes both calls *and* any implementation set by a
  // previous test — important since this module-level RC mock is
  // shared across every test in the file.
  Purchases.configure.mockReset();
  Purchases.getCustomerInfo.mockReset();
  Purchases.purchasePackage.mockReset();
  Purchases.restorePurchases.mockReset();
  Purchases.getProducts.mockReset().mockResolvedValue([]);
  Purchases.getOfferings.mockReset();
  Purchases.addCustomerInfoUpdateListener.mockReset();
  Purchases.removeCustomerInfoUpdateListener.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('initRevenueCat', () => {
  it('configures RC with the iOS key from expo-constants', () => {
    const Purchases = rc();
    const sub = loadModule();
    sub.initRevenueCat();
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'test_rc_key' });
  });

  it('is idempotent — second call does nothing', () => {
    const Purchases = rc();
    const sub = loadModule();
    sub.initRevenueCat();
    sub.initRevenueCat();
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
  });
});

describe('getCurrentStatus', () => {
  it('returns inactive before initRevenueCat is called', async () => {
    const sub = loadModule();
    expect(await sub.getCurrentStatus()).toBe('inactive');
  });

  it('returns active when the canonical entitlement is present', async () => {
    const Purchases = rc();
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo({ full: {} }));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getCurrentStatus()).toBe('active');
  });

  it('falls back to "any active entitlement" when the canonical id drifts', async () => {
    const Purchases = rc();
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo({ premium: {} }));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getCurrentStatus()).toBe('active');
  });

  it('falls back to activeSubscriptions when entitlements are empty', async () => {
    const Purchases = rc();
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo({}, ['nothing_monthly']));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getCurrentStatus()).toBe('active');
  });

  it('returns inactive when nothing is active', async () => {
    const Purchases = rc();
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo({}, []));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getCurrentStatus()).toBe('inactive');
  });

  it('swallows RC errors and returns inactive', async () => {
    const Purchases = rc();
    Purchases.getCustomerInfo.mockRejectedValue(new Error('network'));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getCurrentStatus()).toBe('inactive');
  });
});

describe('addStatusListener', () => {
  it('returns a no-op unsubscribe when not configured', () => {
    const Purchases = rc();
    const sub = loadModule();
    const cb = jest.fn();
    const unsubscribe = sub.addStatusListener(cb);
    expect(typeof unsubscribe).toBe('function');
    expect(Purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
    // Calling the no-op shouldn't blow up.
    unsubscribe();
  });

  it('subscribes after init and translates CustomerInfo into a status string', () => {
    const Purchases = rc();
    let captured: ((info: CustomerInfo) => void) | null = null;
    Purchases.addCustomerInfoUpdateListener.mockImplementation((handler: any) => {
      captured = handler;
    });
    const sub = loadModule();
    sub.initRevenueCat();
    const cb = jest.fn();
    sub.addStatusListener(cb);
    captured!(customerInfo({ full: {} }));
    expect(cb).toHaveBeenCalledWith('active');
    captured!(customerInfo({}, []));
    expect(cb).toHaveBeenCalledWith('inactive');
  });

  it('unsubscribe removes the underlying listener', () => {
    const Purchases = rc();
    const sub = loadModule();
    sub.initRevenueCat();
    const unsubscribe = sub.addStatusListener(jest.fn());
    unsubscribe();
    expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
  });
});

describe('purchasePackage', () => {
  it('returns cancelled when userCancelled is set on the rejection', async () => {
    const Purchases = rc();
    Purchases.purchasePackage.mockRejectedValue({ userCancelled: true });
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.purchasePackage({} as any)).toBe('cancelled');
  });

  it('returns inactive on other errors', async () => {
    const Purchases = rc();
    Purchases.purchasePackage.mockRejectedValue(new Error('boom'));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.purchasePackage({} as any)).toBe('inactive');
  });

  it('returns active when the purchase grants the entitlement', async () => {
    const Purchases = rc();
    Purchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfo({ full: {} }),
    });
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.purchasePackage({} as any)).toBe('active');
  });

  it('returns inactive when not configured', async () => {
    const sub = loadModule();
    expect(await sub.purchasePackage({} as any)).toBe('inactive');
  });
});

describe('restorePurchases', () => {
  it('returns active when restore grants an entitlement', async () => {
    const Purchases = rc();
    Purchases.restorePurchases.mockResolvedValue(customerInfo({ full: {} }));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.restorePurchases()).toBe('active');
  });

  it('returns inactive on error', async () => {
    const Purchases = rc();
    Purchases.restorePurchases.mockRejectedValue(new Error('no-sub'));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.restorePurchases()).toBe('inactive');
  });

  it('returns inactive when not configured', async () => {
    const sub = loadModule();
    expect(await sub.restorePurchases()).toBe('inactive');
  });
});

describe('getProductPriceString', () => {
  it('returns null when not configured', async () => {
    const sub = loadModule();
    expect(await sub.getProductPriceString('nothing_yearly')).toBeNull();
  });

  it('returns the localized price string when the product exists', async () => {
    const Purchases = rc();
    Purchases.getProducts.mockResolvedValue([{ priceString: '$49.99' }]);
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getProductPriceString('nothing_yearly')).toBe('$49.99');
  });

  it('returns null when getProducts returns nothing', async () => {
    const Purchases = rc();
    Purchases.getProducts.mockResolvedValue([]);
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getProductPriceString('nothing_yearly')).toBeNull();
  });

  it('returns null on error', async () => {
    const Purchases = rc();
    Purchases.getProducts.mockRejectedValue(new Error('product not found'));
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getProductPriceString('nothing_yearly')).toBeNull();
  });
});

describe('getOfferings', () => {
  it('returns null when not configured', async () => {
    const sub = loadModule();
    expect(await sub.getOfferings()).toBeNull();
  });

  it('returns the current offering when RC has one', async () => {
    const Purchases = rc();
    const offering = { identifier: 'default' };
    Purchases.getOfferings.mockResolvedValue({ current: offering });
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getOfferings()).toBe(offering);
  });

  it('returns null when current is missing', async () => {
    const Purchases = rc();
    Purchases.getOfferings.mockResolvedValue({ current: null });
    const sub = loadModule();
    sub.initRevenueCat();
    expect(await sub.getOfferings()).toBeNull();
  });
});
