import Constants from 'expo-constants';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

export type SubscriptionStatus = 'unknown' | 'active' | 'inactive';

export const PRO_ENTITLEMENT_ID = 'full';

let configured = false;

function readApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { revenueCatIosKey?: string }
    | undefined;
  return extra?.revenueCatIosKey;
}

function isDevForceSubscribed(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_FORCE_SUBSCRIBED === '1';
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

export async function getCurrentStatus(): Promise<'active' | 'inactive'> {
  if (isDevForceSubscribed()) return 'active';
  if (!configured) return 'inactive';
  try {
    const info = await Purchases.getCustomerInfo();
    return statusFromCustomerInfo(info);
  } catch (e) {
    console.warn('[subscription] getCustomerInfo failed:', e);
    return 'inactive';
  }
}

export function addStatusListener(
  cb: (status: 'active' | 'inactive') => void,
): () => void {
  if (!configured) return () => {};
  const handler = (info: CustomerInfo) => cb(statusFromCustomerInfo(info));
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

// Fetch a single product by its store identifier — used for the "old
// price" anchor on the yearly plan, since `nothing_yearly` isn't in any
// RC package (it's not buyable, just a strikethrough reference price).
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

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<'active' | 'inactive' | 'cancelled'> {
  if (!configured) return 'inactive';
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return statusFromCustomerInfo(customerInfo);
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
    return statusFromCustomerInfo(info);
  } catch (e) {
    console.warn('[subscription] restorePurchases failed:', e);
    return 'inactive';
  }
}
