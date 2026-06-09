import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import FeatureCarousel from '@/components/paywall/FeatureCarousel';
import PlanCard from '@/components/paywall/PlanCard';
import PurchasingOverlay from '@/components/paywall/PurchasingOverlay';
import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';
import { usePaywall } from '@/hooks/usePaywall';
import { ctaLabel, type PlanId } from '@/lib/paywall-config';
import { palette } from '@/lib/theme';

// Dark-green CTA/card colour for the Lifetime plan.
const LIFETIME_COLOR = '#2C4A3E';

// UI metadata for the plan cards. Prices + purchase logic come from
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

function HeroImage({ scrollY }: { scrollY: SharedValue<number> }) {
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * 0.5 }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(800)}
      style={styles.heroContainer}
    >
      <Animated.Image
        source={require('@/assets/images/grass-old.png')}
        style={[styles.heroImage, parallaxStyle]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

interface Props {
  /** Called on skip (the X) and after a successful purchase/restore. The
   *  onboarding paywall passes `onFinish`; the standalone route passes a
   *  router.replace('/'). */
  onClose: () => void;
  /** Suppresses usePaywall's auto-close watcher while the screen isn't the
   *  active onboarding page. Defaults true (standalone route). */
  enabled?: boolean;
}

/**
 * The single source of truth for the paywall UI. Both the standalone
 * `/paywall` route and the onboarding paywall step render this — no layout is
 * duplicated between them.
 */
export default function PaywallView({ onClose, enabled = true }: Props) {
  const insets = useSafeAreaInsets();
  const {
    selectedPlan,
    setSelectedPlan,
    packagesByPlan,
    purchasing,
    skip,
    purchase,
    restore,
  } = usePaywall({ onClose, enabled });

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const ctaColor =
    selectedPlan === 'lifetime' ? LIFETIME_COLOR : palette.terracotta;
  const yearlyPrice = packagesByPlan.yearly?.product.priceString;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
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

        <HeroImage scrollY={scrollY} />

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
              3 days free, then {yearlyPrice}/year. Cancel anytime.
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
      </Animated.ScrollView>

      <PurchasingOverlay visible={purchasing} />
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
