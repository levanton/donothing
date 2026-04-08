import { memo } from 'react';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { Fonts } from '@/constants/theme';
import { timerDisplay } from '@/lib/format';

interface Props {
  seconds: number;
  color: string;
  style?: object;
  fontSize?: number;
}

function TimerDisplay({ seconds, color, style, fontSize = 48 }: Props) {
  return (
    <Animated.Text
      style={[
        styles.timer,
        { color, fontFamily: Fonts!.mono, fontSize },
        style,
      ]}
    >
      {timerDisplay(seconds)}
    </Animated.Text>
  );
}

export default memo(TimerDisplay);

const styles = StyleSheet.create({
  timer: {
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    textAlign: 'center',
  },
});
