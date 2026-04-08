import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PillButton from '@/components/PillButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const BENEFITS = [
  { icon: 'moon', text: 'Deeper sleep', desc: 'Your brain finally winds down instead of processing one more scroll', isMci: false },
  { icon: 'sun', text: 'Lower anxiety', desc: 'Cortisol drops when you stop. Even a few minutes resets your nervous system', isMci: false },
  { icon: 'zap', text: 'Sharper thinking', desc: 'Your working memory and attention improve when your mind gets space to rest', isMci: false },
  { icon: 'brain', text: 'More ideas', desc: 'Idle minds produce 58% more ideas. Your best thinking starts when you stop', isMci: true },
  { icon: 'compass', text: 'Clearer decisions', desc: 'A rested prefrontal cortex chooses quicker and smarter', isMci: false },
  { icon: 'battery-charging', text: 'More energy', desc: 'Short pauses prevent burnout and recharge you for the rest of the day', isMci: false },
];

function BenefitCard({ icon, text, desc, isMci, delay }: {
  icon: string; text: string; desc: string; isMci: boolean; delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: EASE_OUT }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: EASE_OUT }));
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), delay);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.card, style]}>
      <View style={styles.cardIcon}>
        {isMci ? (
          <MaterialCommunityIcons name={icon as any} size={22} color={palette.cream} />
        ) : (
          <Feather name={icon as any} size={20} color={palette.cream} />
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: palette.cream }]}>{text}</Text>
        <Text style={[styles.cardDesc, { color: palette.cream }]}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function DailyBenefitsScreen({ isActive, onNext }: Props) {
  const insets = useSafeAreaInsets();

  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(12);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: EASE_OUT }));
    headerTranslateY.value = withDelay(200, withTiming(0, { duration: 700, easing: EASE_OUT }));
    buttonOpacity.value = withDelay(2800, withTiming(1, { duration: 600, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(2800, withTiming(0, { duration: 600, easing: EASE_OUT }));
  }, [isActive]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: palette.charcoal }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[headerStyle, { alignItems: 'center' }]}>
          <Text style={styles.badge}>5 min / day</Text>
          <Text style={styles.title}>What 5 minutes{'\n'}a day will give you.</Text>
        </Animated.View>

        {isActive && (
          <View style={styles.cardsArea}>
            {BENEFITS.map((b, i) => (
              <BenefitCard
                key={i}
                icon={b.icon}
                text={b.text}
                desc={b.desc}
                isMci={b.isMci}
                delay={900 + i * 400}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Animated.View style={[styles.buttonArea, { bottom: insets.bottom + 24 }, buttonStyle]}>
        <PillButton label="continue" onPress={onNext} variant="filled" size="large" color={palette.charcoal} bg={palette.cream} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  badge: {
    fontFamily: Fonts?.serif,
    fontSize: 14,
    fontWeight: '500',
    color: palette.charcoal,
    backgroundColor: palette.cream,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 16,
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 34,
    fontWeight: '600',
    color: palette.cream,
    textAlign: 'center',
    lineHeight: 42,
  },
  cardsArea: {
    marginTop: 32,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cream + '12',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 3,
  },
  cardDesc: {
    fontFamily: Fonts?.serif,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 20,
  },
  buttonArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
