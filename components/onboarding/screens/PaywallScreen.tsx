import PaywallView from '@/components/paywall/PaywallView';

interface Props {
  isActive: boolean;
  onNext: () => void;
  onFinish: () => void;
  theme: { text: string; bg: string };
}

// The onboarding paywall step. All UI lives in the shared PaywallView (same one
// the standalone /paywall route renders) — no layout is duplicated. `onFinish`
// leaves onboarding; `isActive` gates the auto-close watcher to this page.
export default function PaywallScreen({ isActive, onFinish }: Props) {
  return <PaywallView onClose={onFinish} enabled={isActive} />;
}
