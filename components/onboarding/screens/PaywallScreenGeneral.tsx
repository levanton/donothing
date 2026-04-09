import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import PillButton from '@/components/PillButton';
import PlanCard from '@/components/paywall/PlanCardGeneral';
import FeatureCarousel from '@/components/paywall/FeatureCarousel';

type PlanId = 'monthly' | 'yearly' | 'lifetime';

const PLANS = [
  { id: 'monthly' as PlanId, planName: 'Monthly', price: '$4.99', period: '/month' },
  {
    id: 'yearly' as PlanId,
    planName: 'Yearly',
    price: '$34.99',
    period: '/year',
    oldPrice: '$49.99',
    trialText: 'First 3 days FREE',
    badge: 'Popular',
    isRecommended: true,
  },
  {
    id: 'lifetime' as PlanId,
    planName: 'Lifetime',
    price: '$69.99',
    trialText: 'Pay once, own forever',
    badge: 'Limited',
    badgeColor: palette.umber,
    accentColor: palette.umber,
  },
];

const CTA_LABELS: Record<PlanId, string> = {
  monthly: 'Subscribe — $4.99/mo',
  yearly: 'Try Free for 3 Days',
  lifetime: 'Get Lifetime — $69.99',
};

function HeroImage() {
  return (
    <Animated.View entering={FadeIn.delay(100).duration(800)} style={styles.heroContainer}>
      <Image
        source={require('@/assets/images/grass-old.png')}
        style={styles.heroImage}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  onFinish: () => void;
  theme: { text: string; bg: string };
}

export default function PaywallScreen({ isActive, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFinish();
  }, [onFinish]);

  const handlePurchase = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: integrate RevenueCat purchase flow
    onFinish();
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top bar: skip */}
        <View style={styles.topBar}>
          <Pressable onPress={handleSkip} hitSlop={16} style={styles.closeButton}>
            <Feather name="x" size={22} color={palette.brown} />
          </Pressable>
        </View>

        <HeroImage />

        <FeatureCarousel />

        {/* Plan cards */}
        <Animated.View entering={FadeInUp.delay(800).duration(500)} style={styles.plans}>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              planName={plan.planName}
              price={plan.price}
              period={plan.period}
              oldPrice={plan.oldPrice}
              trialText={plan.trialText}
              badge={plan.badge}
              badgeColor={plan.badgeColor}
              accentColor={plan.accentColor}
              isRecommended={plan.isRecommended}
              isSelected={selectedPlan === plan.id}
              onSelect={() => setSelectedPlan(plan.id)}
            />
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(1000).duration(500)} style={styles.cta}>
          <PillButton
            label={CTA_LABELS[selectedPlan]}
            onPress={handlePurchase}
            color={selectedPlan === 'lifetime' ? palette.umber : palette.terracotta}
            variant="filled"
            size="large"
            style={[styles.ctaButton, {
              shadowColor: selectedPlan === 'lifetime' ? palette.umber : palette.terracotta,
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              paddingVertical: 20,
            }]}
          />
          {selectedPlan === 'yearly' && (
            <Text style={styles.ctaHelper}>Then $34.99/year. Cancel anytime.</Text>
          )}
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(1100).duration(500)} style={styles.footer}>
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
  heroContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  heroImage: {
    width: 280,
    height: 160,
  },
  plans: {
    marginTop: 28,
    paddingHorizontal: 24,
    gap: 12,
  },
  cta: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  ctaButton: {
    alignSelf: 'stretch',
  },
  ctaHelper: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    color: `${palette.brown}80`,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  footerLink: {
    fontSize: 11,
    fontWeight: '400',
    color: palette.brown + '80',
  },
  footerDot: {
    fontSize: 11,
    color: palette.brown + '4D',
  },
});
