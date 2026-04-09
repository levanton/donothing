import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import PillButton from '@/components/PillButton';
import PlanCard from '@/components/paywall/PlanCardGeneral';

const CARD_WIDTH = 170;
const CARD_HEIGHT = 210;

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

const FEATURES = [
  { id: 'lock', label: 'Focus\nLock', bg: palette.terracotta, fg: palette.cream },
  { id: 'stats', label: 'Full\nStatistics', bg: palette.charcoal, fg: palette.cream },
  { id: 'goals', label: 'Custom\nGoals', bg: palette.salmon, fg: palette.charcoal },
  { id: 'reminders', label: 'Unlimited\nReminders', bg: palette.charcoal, fg: palette.cream },
  { id: 'calendar', label: 'Activity\nCalendar', bg: palette.terracotta, fg: palette.cream },
] as const;

function FeatureIllustration({ id, color }: { id: string; color: string }) {
  const w = 140;
  const h = 110;
  const o2 = `${color}20`;
  const o4 = `${color}40`;
  const o6 = `${color}60`;

  switch (id) {
    case 'lock':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          <Rect x={35} y={5} width={70} height={100} rx={14} fill={o2} />
          <Rect x={40} y={12} width={60} height={78} rx={4} fill={o4} />
          <Path d="M70 30 L92 38 L92 58 C92 72 70 82 70 82 C70 82 48 72 48 58 L48 38 Z" fill={color} />
          <Rect x={62} y={52} width={16} height={13} rx={3} fill={o2} />
          <Path d="M65 52V47a5 5 0 0 1 10 0v5" fill="none" stroke={o2} strokeWidth={2.5} strokeLinecap="round" />
          <Circle cx={22} cy={20} r={4} fill={o4} />
          <Circle cx={16} cy={50} r={6} fill={o2} />
          <Circle cx={120} cy={30} r={5} fill={o4} />
          <Circle cx={125} cy={70} r={3} fill={o2} />
          <Rect x={60} y={7} width={20} height={4} rx={2} fill={o4} />
        </Svg>
      );
    case 'stats':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          <Rect x={10} y={8} width={120} height={90} rx={14} fill={o2} />
          <Rect x={22} y={62} width={14} height={24} rx={4} fill={o4} />
          <Rect x={42} y={48} width={14} height={38} rx={4} fill={o6} />
          <Rect x={62} y={32} width={14} height={54} rx={4} fill={color} />
          <Rect x={82} y={42} width={14} height={44} rx={4} fill={o6} />
          <Rect x={102} y={28} width={14} height={58} rx={4} fill={o4} />
          <Path d="M29 58 L49 44 L69 28 L89 38 L109 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={29} cy={58} r={3.5} fill={color} />
          <Circle cx={49} cy={44} r={3.5} fill={color} />
          <Circle cx={69} cy={28} r={4.5} fill={color} />
          <Circle cx={89} cy={38} r={3.5} fill={color} />
          <Circle cx={109} cy={24} r={3.5} fill={color} />
          <Path d="M112 18 L109 24 L115 22" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'goals':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          <Circle cx={70} cy={50} r={46} fill="none" stroke={o2} strokeWidth={3} />
          <Circle cx={70} cy={50} r={33} fill="none" stroke={o4} strokeWidth={4} />
          <Circle cx={70} cy={50} r={20} fill="none" stroke={o6} strokeWidth={5} />
          <Circle cx={70} cy={50} r={8} fill={color} />
          <Line x1={70} y1={50} x2={70} y2={2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M70 2 L90 9 L70 16" fill={color} />
          <Path d="M18 28 L22 32 L30 22" fill="none" stroke={o6} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M110 68 L114 72 L122 62" fill="none" stroke={o4} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={120} cy={22} r={4} fill={o4} />
          <Circle cx={18} cy={78} r={3} fill={o2} />
          <Circle cx={126} cy={88} r={5} fill={o2} />
        </Svg>
      );
    case 'reminders':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          <Rect x={18} y={8} width={104} height={36} rx={12} fill={o2} />
          <Circle cx={38} cy={26} r={8} fill={o4} />
          <Rect x={52} y={20} width={50} height={5} rx={2.5} fill={o4} />
          <Rect x={52} y={29} width={30} height={4} rx={2} fill={o2} />
          <Rect x={12} y={34} width={116} height={36} rx={12} fill={o4} />
          <Circle cx={34} cy={52} r={8} fill={o6} />
          <Rect x={48} y={46} width={56} height={5} rx={2.5} fill={o6} />
          <Rect x={48} y={55} width={34} height={4} rx={2} fill={o4} />
          <Rect x={6} y={60} width={128} height={40} rx={12} fill={color} />
          <Circle cx={30} cy={80} r={10} fill={o4} />
          <Path d="M30 74 a5 5 0 0 1 5 5v2l1.5 1.5H23.5L25 81v-2a5 5 0 0 1 5-5Z" fill={o2} />
          <Rect x={46} y={74} width={68} height={5} rx={2.5} fill={o4} />
          <Rect x={46} y={83} width={42} height={4} rx={2} fill={o2} />
          <Circle cx={126} cy={64} r={10} fill={`${palette.salmon}CC`} />
          <Rect x={121} y={61} width={10} height={6} rx={1} fill={color} />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          <Rect x={10} y={12} width={120} height={88} rx={14} fill={o2} />
          <Rect x={10} y={12} width={120} height={24} rx={14} fill={o4} />
          <Rect x={10} y={24} width={120} height={12} rx={0} fill={o4} />
          {[30, 48, 66, 84, 102].map((x) => (
            <Rect key={`dh${x}`} x={x - 4} y={18} width={8} height={3} rx={1.5} fill={o6} />
          ))}
          <Circle cx={30} cy={48} r={5} fill={o4} />
          <Circle cx={48} cy={48} r={5} fill={o6} />
          <Circle cx={66} cy={48} r={5} fill={color} />
          <Circle cx={84} cy={48} r={5} fill={color} />
          <Circle cx={102} cy={48} r={5} fill={o6} />
          <Circle cx={30} cy={62} r={5} fill={color} />
          <Circle cx={48} cy={62} r={5} fill={color} />
          <Circle cx={66} cy={62} r={5} fill={color} />
          <Circle cx={84} cy={62} r={5} fill={o4} />
          <Circle cx={102} cy={62} r={5} fill={color} />
          <Circle cx={30} cy={76} r={5} fill={o6} />
          <Circle cx={48} cy={76} r={5} fill={color} />
          <Circle cx={66} cy={76} r={5} fill={o4} />
          <Circle cx={84} cy={76} r={5} fill={color} />
          <Circle cx={102} cy={76} r={5} fill={color} />
          <Rect x={58} y={42} width={34} height={12} rx={6} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
          <Circle cx={84} cy={76} r={8} fill="none" stroke={color} strokeWidth={2} />
        </Svg>
      );
    default:
      return null;
  }
}

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

function FeatureCard({ id, label, bg, fg, index }: typeof FEATURES[number] & { index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 100).duration(500)}
      style={[styles.featureCard, { backgroundColor: bg }]}
    >
      <View style={styles.featureIllustration}>
        <FeatureIllustration id={id} color={fg} />
      </View>
      <Text style={[styles.featureLabel, { color: fg }]}>{label}</Text>
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
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  featureIllustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23,
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
