import { memo, useCallback, useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '@/lib/theme';

const CARD_WIDTH = 132;
const CARD_HEIGHT = 176;
const GAP = 12;
const ITEM_SIZE = CARD_WIDTH + GAP;

const FEATURES = [
  // Muted deep petrol — the teal toned down so it sits with the warm
  // umber + gold instead of shouting over them.
  { id: 'lock', label: 'Unlimited\nLocks', bg: '#3C514C', fg: palette.cream },
  // Dark umber.
  { id: 'dim', label: 'Distraction\nFree', bg: palette.umber, fg: palette.cream },
  // Muted gold — a touch deeper so cream reads cleanly.
  { id: 'calendar', label: 'Your\nJourney', bg: '#AD8240', fg: palette.cream },
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
    case 'dim':
      return (
        <Svg width={w} height={h} viewBox="0 0 140 110">
          {/* an orb (the screen) fading from lit to dark — the dim */}
          <Circle cx={70} cy={55} r={40} fill={o2} />
          <Path d="M70 15 A40 40 0 0 0 70 95 Z" fill={color} />
          <Circle cx={70} cy={55} r={40} fill="none" stroke={o4} strokeWidth={2} />
          {/* calm specks */}
          <Circle cx={22} cy={24} r={3.5} fill={o4} />
          <Circle cx={120} cy={32} r={4} fill={o2} />
          <Circle cx={116} cy={82} r={3} fill={o4} />
          <Circle cx={20} cy={84} r={2.5} fill={o2} />
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

const FeatureCard = memo(function FeatureCard({ id, label, bg, fg }: typeof FEATURES[number]) {
  return (
    <View style={[styles.featureCard, { backgroundColor: bg }]}>
      <View style={styles.featureIllustration}>
        <FeatureIllustration id={id} color={fg} />
      </View>
      <Text style={[styles.featureLabel, { color: fg }]}>{label}</Text>
    </View>
  );
});

// 20 copies — user will never reach the end
const REPEAT = 20;
const LOOP_DATA = Array.from({ length: FEATURES.length * REPEAT }, (_, i) => ({
  ...FEATURES[i % FEATURES.length],
  key: `f${i}`,
}));
const MIDDLE_OFFSET = Math.floor(REPEAT / 2) * FEATURES.length * ITEM_SIZE;

const getItemLayout = (_: any, index: number) => ({
  length: ITEM_SIZE,
  offset: ITEM_SIZE * index,
  index,
});

export default function FeatureCarousel() {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: MIDDLE_OFFSET, animated: false });
  }, []);

  const renderItem = useCallback(({ item }: { item: typeof LOOP_DATA[number] }) => {
    const { key: _key, ...props } = item;
    return <FeatureCard {...props} />;
  }, []);

  return (
    <Animated.View entering={FadeIn.delay(400).duration(500)}>
      <FlatList
        ref={listRef}
        data={LOOP_DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={ITEM_SIZE}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
    gap: GAP,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textTransform: 'uppercase',
  },
});
