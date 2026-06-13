import Constants from 'expo-constants';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { userDefaultsSet } from 'react-native-device-activity';

export type SubscriptionStatus = 'unknown' | 'active' | 'inactive';

export const PRO_ENTITLEMENT_ID = 'full';

// App Group UserDefaults keys mirrored for the ActivityMonitorExtension's
// subscription gate. The extension runs in its own process where RevenueCat
// isn't available and a direct StoreKit read can come back empty right after
// a reinstall (or in sandbox), so RC's verdict — the same source of truth the
// UI uses — is written here on every CustomerInfo resolve and read natively
// at block fire time. Keys must match DeviceActivityMonitorExtension.swift.
const MIRROR_STATUS_KEY = 'nothing_subscription_status';
const MIRROR_EXPIRES_AT_KEY = 'nothing_subscription_expires_at';

let configured = false;

function readApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { revenueCatIosKey?: string }
    | undefined;
  return extra?.revenueCatIosKey;
}

function statusFromCustomerInfo(info: CustomerInfo): 'active' | 'inactive' {
  if (info.entitlements.active[PRO_ENTITLEMENT_ID]) return 'active';
  // Fallback: any active entitlement (handles entitlement ID drift in RC)
  if (Object.keys(info.entitlements.active).length > 0) return 'active';
  // Last resort: an active subscription product is enough since we have a
  // single-tier model — if RC sees an active sub on this customer, treat
  // them as 'pro' regardless of how the entitlement was named.
  if (info.activeSubscriptions.length > 0) return 'active';
  return 'inactive';
}

function mirrorStatusToAppGroup(
  status: 'active' | 'inactive',
  info: CustomerInfo,
): void {
  try {
    // -1 = no known expiry (lifetime purchase, or RC didn't report a date).
    // Otherwise the latest expiration across active entitlements, epoch ms.
    let expiresAt = -1;
    let sawLifetime = false;
    for (const ent of Object.values(info.entitlements.active)) {
      if (!ent.expirationDate) {
        sawLifetime = true;
        break;
      }
      const t = Date.parse(ent.expirationDate);
      if (Number.isFinite(t)) expiresAt = Math.max(expiresAt, t);
    }
    if (sawLifetime) expiresAt = -1;
    userDefaultsSet(MIRROR_STATUS_KEY, status);
    userDefaultsSet(MIRROR_EXPIRES_AT_KEY, expiresAt);
  } catch (e) {
    // Mirror failure must never break the purchase/status flow — the
    // extension falls back to its StoreKit check when keys are absent.
    console.warn('[subscription] app-group mirror failed:', e);
  }
}

/** Resolve status from CustomerInfo AND mirror it for the native gate. */
function resolveStatus(info: CustomerInfo): 'active' | 'inactive' {
  const status = statusFromCustomerInfo(info);
  mirrorStatusToAppGroup(status, info);
  return status;
}

export function initRevenueCat(): void {
  if (configured) return;
  const apiKey = readApiKey();
  if (!apiKey) {
    console.warn(
      '[subscription] RevenueCat iOS key missing — skipping configure',
    );
    return;
  }
  Purchases.configure({ apiKey });
  configured = true;
}

/**
 * RevenueCat's stable app-user id for the current install. Anonymous (looks
 * like `$RCAnonymousID:…` until/unless we ever call logIn), so it carries no
 * real-world identity — we only use it to stitch analytics events to purchase
 * outcomes. Returns null until RC is configured.
 */
export async function getAppUserId(): Promise<string | null> {
  if (!configured) return null;
  try {
    return await Purchases.getAppUserID();
  } catch (e) {
    console.warn('[subscription] getAppUserID failed:', e);
    return null;
  }
}

export async function getCurrentStatus(): Promise<SubscriptionStatus> {
  if (!configured) return 'inactive';
  try {
    const info = await Purchases.getCustomerInfo();
    return resolveStatus(info);
  } catch (e) {
    // 'unknown', not 'inactive' — a transient RC/network failure must not
    // be treated as a lapsed subscription (the unknown→inactive transition
    // force-unblocks everything, which would strip a paying user's blocks
    // on an offline cold start).
    console.warn('[subscription] getCustomerInfo failed:', e);
    return 'unknown';
  }
}

export function addStatusListener(
  cb: (status: 'active' | 'inactive') => void,
): () => void {
  if (!configured) return () => {};
  const handler = (info: CustomerInfo) => cb(resolveStatus(info));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(handler);
    } catch (e) {
      console.warn('[subscription] remove listener failed:', e);
    }
  };
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn('[subscription] getOfferings failed:', e);
    return null;
  }
}

// Fetch a single product's localized price by its store identifier, outside of
// any RC offering. Generic helper (the old strikethrough-anchor caller was
// removed when nothing_yearly became the real buyable yearly product).
export async function getProductPriceString(
  productId: string,
): Promise<string | null> {
  if (!configured) return null;
  try {
    const products = await Purchases.getProducts([productId]);
    return products[0]?.priceString ?? null;
  } catch (e) {
    console.warn('[subscription] getProducts failed:', e);
    return null;
  }
}

/**
 * Whether the user can actually redeem the intro/discount price on a
 * product. Apple grants an introductory offer ONCE per subscription
 * group — a returning subscriber who already used it pays full price,
 * even though the product still advertises an `introPrice`. Showing them
 * a "50% off" win-back is a broken promise (they tap, the discount isn't
 * there). Call this before surfacing any intro-priced promo.
 *
 * Returns true ONLY for an explicit ELIGIBLE verdict. UNKNOWN (RC docs:
 * "display the non-intro pricing"), INELIGIBLE, and NO_INTRO_OFFER_EXISTS
 * all mean "don't promise the discount".
 */
export async function isIntroEligible(productId: string): Promise<boolean> {
  if (!configured) return false;
  try {
    const map = await Purchases.checkTrialOrIntroductoryPriceEligibility([
      productId,
    ]);
    return (
      map[productId]?.status ===
      INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
    );
  } catch (e) {
    // On any failure, don't promise a discount we can't confirm.
    console.warn('[subscription] intro eligibility check failed:', e);
    return false;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<'active' | 'inactive' | 'cancelled'> {
  if (!configured) return 'inactive';
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return resolveStatus(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return 'cancelled';
    console.warn('[subscription] purchasePackage failed:', e);
    return 'inactive';
  }
}

export async function restorePurchases(): Promise<'active' | 'inactive'> {
  if (!configured) return 'inactive';
  try {
    const info = await Purchases.restorePurchases();
    return resolveStatus(info);
  } catch (e) {
    console.warn('[subscription] restorePurchases failed:', e);
    return 'inactive';
  }
}
