import { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import PillButton from '@/components/PillButton';
import PlanCard from '@/components/paywall/PlanCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 170;
const CARD_HEIGHT = 190;

type PlanId = 'monthly' | 'yearly' | 'lifetime';

const PLANS: { id: PlanId; name: string; price: string; subtitle?: string; badge?: string }[] = [
  { id: 'monthly', name: 'Monthly', price: '$2.99/mo' },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$24.99/yr',
    subtitle: 'First 3 days free',
    badge: 'Best Value',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$44.99',
    subtitle: 'Pay once, own forever',
    badge: 'Limited',
  },
];

const FEATURES = [
  { icon: 'lock' as const, label: 'Focus\nLock', bg: palette.terracotta, fg: palette.cream },
  { icon: 'bar-chart-2' as const, label: 'Full\nStatistics', bg: palette.charcoal, fg: palette.cream },
  { icon: 'target' as const, label: 'Custom\nGoals', bg: palette.salmon, fg: palette.charcoal },
  { icon: 'bell' as const, label: 'Unlimited\nReminders', bg: palette.charcoal, fg: palette.cream },
  { icon: 'calendar' as const, label: 'Activity\nCalendar', bg: palette.terracotta, fg: palette.cream },
] as const;

const CTA_LABELS: Record<PlanId, string> = {
  monthly: 'Subscribe',
  yearly: 'Try Free for 3 Days',
  lifetime: 'Buy Once',
};

// Decorative hero orbit illustration
function HeroIllustration() {
  const size = 200;
  const center = size / 2;
  const ringRadius = 70;

  return (
    <Animated.View entering={FadeIn.delay(100).duration(800)} style={styles.heroContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer glow circle */}
        <Circle cx={center} cy={center} r={90} fill={`${palette.salmon}25`} />
        {/* Salmon circle */}
        <Circle cx={center} cy={center} r={ringRadius} fill="none" stroke={palette.salmon} strokeWidth={2} />
        {/* Terracotta orbit ring */}
        <Circle cx={center} cy={center} r={50} fill="none" stroke={palette.terracotta} strokeWidth={2.5} strokeDasharray="8 6" />
        {/* Center dot */}
        <Circle cx={center} cy={center} r={6} fill={palette.terracotta} />
        {/* Orbiting dots */}
        <Circle cx={center + ringRadius} cy={center} r={5} fill={palette.salmon} />
        <Circle cx={center} cy={center - ringRadius} r={4} fill={palette.terracotta} />
        <Circle cx={center - ringRadius * 0.7} cy={center + ringRadius * 0.7} r={3.5} fill={`${palette.brown}60`} />
      </Svg>
    </Animated.View>
  );
}

// Feature card for horizontal carousel
function FeatureCard({ icon, label, bg, fg, index }: typeof FEATURES[number] & { index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 100).duration(500)}
      style={[styles.featureCard, { backgroundColor: bg }]}
    >
      <View style={styles.featureIconWrap}>
        <Feather name={icon} size={32} color={fg} />
      </View>
      <Text style={[styles.featureLabel, { color: fg }]}>{label}</Text>
    </Animated.View>
  );
}

export default function PaywallRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/');
  }, [router]);

  const handlePurchase = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: integrate RevenueCat purchase flow
    router.replace('/');
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top bar: close button */}
        <View style={styles.topBar}>
          <Pressable onPress={handleSkip} hitSlop={16} style={styles.closeButton}>
            <Feather name="x" size={22} color={palette.brown} />
          </Pressable>
        </View>

        {/* Hero illustration */}
        <HeroIllustration />

        {/* Feature cards carousel */}
        <Animated.View entering={FadeIn.delay(400).duration(500)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + 12}
          >
            {FEATURES.map((feature, idx) => (
              <FeatureCard key={feature.label} {...feature} index={idx} />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Plan cards */}
        <Animated.View
          entering={FadeInUp.delay(800).duration(500)}
          style={styles.plans}
        >
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              price={plan.price}
              subtitle={plan.subtitle}
              badge={plan.badge}
              isSelected={selectedPlan === plan.id}
              onSelect={() => setSelectedPlan(plan.id)}
            />
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View
          entering={FadeInUp.delay(1000).duration(500)}
          style={styles.cta}
        >
          <PillButton
            label={CTA_LABELS[selectedPlan]}
            onPress={handlePurchase}
            color={palette.terracotta}
            variant="filled"
            size="large"
            style={styles.ctaButton}
          />
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(1100).duration(500)}
          style={styles.footer}
        >
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.footerDot}>|</Text>
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.footerDot}>|</Text>
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Restore Purchases</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {},
  // Hero
  heroContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  // Feature carousel
  carousel: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
    gap: 12,
  },
  featureCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23,
  },
  // Plans
  plans: {
    marginTop: 28,
    paddingHorizontal: 24,
    gap: 12,
  },
  // CTA
  cta: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  ctaButton: {
    alignSelf: 'stretch',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '400',
    color: palette.brown + '80',
  },
  footerDot: {
    fontSize: 13,
    color: palette.brown + '4D',
  },
});
