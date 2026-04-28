import { memo, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import { palette } from '@/lib/theme';
import { MILESTONES } from '@/lib/milestones';

interface Props {
  theme: AppTheme;
  achievedMilestones: Map<string, number>;
}

// ── Categories with unique colors ─────────────────────────────────────
interface Category {
  id: string;
  label: string;
  bg: string;
  fg: string;
  milestoneIds: string[];
}

const CATEGORIES: Category[] = [
  { id: 'all', label: 'All', bg: palette.charcoal, fg: palette.cream, milestoneIds: MILESTONES.map((m) => m.id) },
  { id: 'streaks', label: 'Streaks', bg: palette.terracotta, fg: palette.cream, milestoneIds: ['streak_3', 'streak_7', 'streak_14', 'streak_30'] },
  { id: 'sessions', label: 'Sessions', bg: palette.salmon, fg: palette.charcoal, milestoneIds: ['first_session', 'ten_sessions', 'fifty_sessions', 'hundred_sessions'] },
  { id: 'duration', label: 'Duration', bg: '#8B6B5B', fg: palette.cream, milestoneIds: ['first_hour', 'five_hours', 'twenty_four_hours', 'days_100'] },
  { id: 'records', label: 'Records', bg: palette.brown, fg: palette.cream, milestoneIds: ['five_minutes', 'thirty_minutes', 'one_hour_session'] },
];

// ── SVG illustrations ─────────────────────────────────────────────────
function CardIllustration({ id, color }: { id: string; color: string }) {
  const o3 = `${color}50`;
  const o5 = `${color}80`;
  switch (id) {
    case 'all':
      return (<Svg width={44} height={44} viewBox="0 0 44 44"><Circle cx={22} cy={22} r={18} fill="none" stroke={o3} strokeWidth={2} /><Circle cx={22} cy={22} r={10} fill="none" stroke={o5} strokeWidth={2} /><Circle cx={22} cy={22} r={3} fill={color} /></Svg>);
    case 'streaks':
      return (<Svg width={44} height={44} viewBox="0 0 44 44"><Path d="M22 6 C22 6 32 16 32 26 C32 32 27.5 38 22 38 C16.5 38 12 32 12 26 C12 16 22 6 22 6Z" fill={o3} /><Path d="M22 18 C22 18 28 24 28 28 C28 31 25 34 22 34 C19 34 16 31 16 28 C16 24 22 18 22 18Z" fill={color} /></Svg>);
    case 'sessions':
      return (<Svg width={44} height={44} viewBox="0 0 44 44"><Rect x={6} y={24} width={7} height={14} rx={3} fill={o3} /><Rect x={18} y={16} width={7} height={22} rx={3} fill={o5} /><Rect x={30} y={8} width={7} height={30} rx={3} fill={color} /></Svg>);
    case 'duration':
      return (<Svg width={44} height={44} viewBox="0 0 44 44"><Circle cx={22} cy={22} r={16} fill="none" stroke={o3} strokeWidth={2.5} /><Line x1={22} y1={22} x2={22} y2={12} stroke={color} strokeWidth={2.5} strokeLinecap="round" /><Line x1={22} y1={22} x2={30} y2={22} stroke={o5} strokeWidth={2} strokeLinecap="round" /><Circle cx={22} cy={22} r={2} fill={color} /></Svg>);
    case 'records':
      return (<Svg width={44} height={44} viewBox="0 0 44 44"><Path d="M22 4 L26 16 L38 16 L28 24 L32 36 L22 28 L12 36 L16 24 L6 16 L18 16Z" fill={o3} /><Path d="M22 12 L24 20 L32 20 L26 25 L28 33 L22 28 L16 33 L18 25 L12 20 L20 20Z" fill={color} /></Svg>);
    default: return null;
  }
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function MilestonesList({ theme, achievedMilestones }: Props) {
  const [selectedCat, setSelectedCat] = useState('all');

  const handleCatPress = useCallback((id: string) => {
    haptics.light();
    setSelectedCat(id);
  }, []);

  const selectedCategory = CATEGORIES.find((c) => c.id === selectedCat) ?? CATEGORIES[0];
  const filteredMilestones = MILESTONES.filter((m) => selectedCategory.milestoneIds.includes(m.id));
  const catColor = selectedCategory.bg === palette.charcoal ? theme.accent : selectedCategory.bg;

  const achievedInCat = (cat: Category) =>
    cat.milestoneIds.filter((id) => achievedMilestones.has(id)).length;

  return (
    <View style={styles.container}>
      {/* Category cards — edge to edge scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsScroll}
        style={styles.cardsScrollOuter}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCat === cat.id;
          const achieved = achievedInCat(cat);
          const total = cat.milestoneIds.length;

          return (
            <Pressable key={cat.id} onPress={() => handleCatPress(cat.id)}>
              <View style={[
                styles.card,
                { backgroundColor: cat.bg },
                isSelected && styles.cardSelected,
              ]}>
                <CardIllustration id={cat.id} color={cat.fg} />
                <Text style={[styles.cardLabel, { color: cat.fg, fontFamily: Fonts.serif }]}>
                  {cat.label}
                </Text>
                <Text style={[styles.cardProgress, { color: cat.fg + '80', fontFamily: Fonts.mono }]}>
                  {achieved}/{total}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Milestone cards — 2-column grid */}
      <View style={styles.grid}>
        {filteredMilestones.map((m, idx) => {
          const achievedAt = achievedMilestones.get(m.id);
          const achieved = achievedAt !== undefined;

          return (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(idx * 60).duration(300)}
              layout={Layout.duration(200)}
              style={[
                styles.milestoneCard,
                {
                  backgroundColor: achieved ? catColor + '15' : theme.bg,
                  borderColor: achieved ? catColor : theme.text,
                  borderWidth: 1,
                },
              ]}
            >
              {/* Status dot */}
              <View style={[
                styles.statusDot,
                achieved
                  ? { backgroundColor: catColor }
                  : { borderWidth: 1.5, borderColor: theme.text },
              ]} />

              <Text
                style={[
                  styles.milestoneTitle,
                  {
                    color: theme.text,
                    fontFamily: Fonts.serif,
                  },
                ]}
                numberOfLines={2}
              >
                {m.title}
              </Text>

              {achieved ? (
                <Text style={[styles.milestoneDate, { color: catColor, fontFamily: Fonts.mono }]}>
                  {achievedAt ? formatDate(achievedAt) : ''}
                </Text>
              ) : (
                <Text style={[styles.milestoneHint, { color: theme.text, fontFamily: Fonts.serif }]}>
                  {m.description.split('.')[0]}
                </Text>
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(MilestonesList);

const CARD_SIZE = 100;

const styles = StyleSheet.create({
  container: {},

  // Category cards — edge to edge
  cardsScrollOuter: {
    marginHorizontal: -24,
  },
  cardsScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE + 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  cardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    transform: [{ scale: 1.04 }],
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  cardProgress: {
    fontSize: 11,
    fontWeight: '400',
  },

  // Milestone cards — 2-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 14,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 8,
  },
  milestoneDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  milestoneHint: {
    fontSize: 13,
    fontWeight: '300',
    lineHeight: 18,
  },
});
