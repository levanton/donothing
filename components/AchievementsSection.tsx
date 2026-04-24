import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import MilestonesList from './MilestonesList';

interface Props {
  theme: AppTheme;
  showDivider?: boolean;
}

function AchievementsSection({ theme, showDivider = true }: Props) {
  const achievedMilestones = useAppStore((s) => s.achievedMilestones);

  return (
    <View>
      {showDivider && (
        <View style={styles.dividerOuter}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>
      )}
      <Text style={[styles.sectionLabel, { color: theme.text }]}>MILESTONES</Text>
      <MilestonesList theme={theme} achievedMilestones={achievedMilestones} />
    </View>
  );
}

export default memo(AchievementsSection);

const styles = StyleSheet.create({
  dividerOuter: { alignItems: 'center', marginVertical: 28 },
  dividerLine: { width: 40, height: 1 },
  sectionLabel: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },
});
