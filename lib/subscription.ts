import Constants from 'expo-constants';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

export type SubscriptionStatus = 'unknown' | 'active' | 'inactive';

export const PRO_ENTITLEMENT_ID = 'pro';

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
  return info.entitlements.active[PRO_ENTITLEMENT_ID] ? 'active' : 'inactive';
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
