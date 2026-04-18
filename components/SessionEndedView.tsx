import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { themes, type ThemeMode } from '@/lib/theme';
import PillButton from '@/components/PillButton';

function Enso({ color, size = 96 }: { color: string; size?: number }) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = (20 * Math.PI) / 180;
  const endAngle = (320 * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const d = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-30deg' }] }}>
      <Path d={d} stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

interface Props {
  themeMode: ThemeMode;
  onStartAgain: () => void;
}

export default function SessionEndedView({ themeMode, onStartAgain }: Props) {
  const insets = useSafeAreaInsets();
  const theme = themes[themeMode];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 120, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.center}>
        <Enso color={theme.text} size={96} />
        <Text style={[styles.label, { color: theme.textSecondary, fontFamily: Fonts?.serif }]}>
          session ended
        </Text>
      </View>

      <View style={styles.buttonWrap}>
        <PillButton
          label="start again"
          onPress={onStartAgain}
          color={theme.accent}
          variant="filled"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    gap: 28,
  },
  label: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  buttonWrap: {
    alignItems: 'center',
  },
});
