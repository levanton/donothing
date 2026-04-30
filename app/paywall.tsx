import { useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import FeatureCarousel from '@/components/paywall/FeatureCarousel';
import PlanCard from '@/components/paywall/PlanCard';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';
import { usePaywall } from '@/hooks/usePaywall';
import { ctaLabel, type PlanId } from '@/lib/paywall-config';
import { palette } from '@/lib/theme';

// UI metadata for the plan cards. Prices and purchase logic come from
// usePaywall(); changes here are pure visual.
const PLANS: {
  id: PlanId;
  name: string;
  periodSuffix?: string;
  subtitle?: string;
  badge?: string;
}[] = [
  { id: 'monthly', name: 'Monthly', periodSuffix: ' / month' },
  {
    id: 'yearly',
    name: 'Yearly',
    periodSuffix: ' / year',
    subtitle: 'First 3 days FREE!',
    badge: 'Popular',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    subtitle: 'Pay once, own forever',
    badge: 'Limited',
  },
];

function HeroImage() {
  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(800)}
      style={styles.heroContainer}
    >
      <Image
        source={require('@/assets/images/grass-old.png')}
        style={styles.heroImage}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function PaywallRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onClose = useCallback(() => router.replace('/'), [router]);
  const {
    selectedPlan,
    setSelectedPlan,
    packagesByPlan,
    anchorYearly,
    skip,
    purchase,
    restore,
  } = usePaywall({ onClose });

  const ctaColor =
    selectedPlan === 'lifetime' ? palette.umber : palette.terracotta;
  const yearlyPrice = packagesByPlan.yearly?.product.priceString;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={skip} hitSlop={16} style={styles.closeButton}>
            <Feather name="x" size={22} color={palette.brown} />
          </Pressable>
        </View>

        <HeroImage />

        <FeatureCarousel />

        <Animated.View
          entering={FadeInUp.delay(800).duration(500)}
          style={styles.plans}
        >
          {PLANS.map((plan) => {
            const pkg = packagesByPlan[plan.id];
            const basePrice = pkg?.product.priceString ?? '';
            const price = basePrice
              ? `${basePrice}${plan.periodSuffix ?? ''}`
              : '';
            return (
              <PlanCard
                key={plan.id}
                name={plan.name}
                price={price}
                oldPrice={plan.id === 'yearly' ? anchorYearly ?? undefined : undefined}
                subtitle={plan.subtitle}
                badge={plan.badge}
                variant={plan.id === 'lifetime' ? 'dark' : 'default'}
                isSelected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
              />
            );
          })}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(1000).duration(500)}
          style={styles.cta}
        >
          <PillButton
            label={ctaLabel(selectedPlan, packagesByPlan)}
            onPress={purchase}
            color={ctaColor}
            variant="filled"
            size="large"
            style={[
              styles.ctaButton,
              {
                shadowColor: ctaColor,
                shadowOpacity: 0.25,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              },
            ]}
          />
          {selectedPlan === 'yearly' && yearlyPrice && (
            <Text style={styles.ctaHelper}>
              Then {yearlyPrice}/year. Cancel anytime.
            </Text>
          )}
        </Animated.View>

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
          <Pressable hitSlop={8} onPress={restore}>
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
    backgroundColor: palette.warmCream,
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
    paddingVertical: 20,
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
