import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import PaywallView from '@/components/paywall/PaywallView';

// The standalone /paywall route — reached from PaywallGate ("see plans").
// All UI lives in the shared PaywallView; this is just the route wrapper.
export default function PaywallRoute() {
  const router = useRouter();
  const onClose = useCallback(() => router.replace('/'), [router]);
  return <PaywallView onClose={onClose} />;
}
