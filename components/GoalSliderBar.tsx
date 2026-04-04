import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { runOnJS, useFrameCallback } from 'react-native-reanimated';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';

const SLIDER_H = 24;
export const SLIDER_PAD = 10;

interface GoalSliderBarProps {
  progress: Animated.SharedValue<number>;
  theme: any;
  width: number;
}

export default function GoalSliderBar({ progress, theme, width }: GoalSliderBarProps) {
  const [p, setP] = useState(0);

  useFrameCallback(() => {
    const v = progress.value;
    if (Math.abs(v - p) > 0.005) {
      runOnJS(setP)(v);
    }
  });

  const cy = SLIDER_H / 2;
  const trackW = width - SLIDER_PAD * 2;
  const fillX = SLIDER_PAD + p * trackW;
  const ticks = [15, 30, 45];

  return (
    <View style={{ width, height: SLIDER_H + 20, alignItems: 'center' }}>
      <Svg width={width} height={SLIDER_H}>
        <SvgPath
          d={`M ${SLIDER_PAD} ${cy} L ${width - SLIDER_PAD} ${cy}`}
          stroke={theme.border}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {ticks.map((m) => {
          const tx = SLIDER_PAD + (m / 60) * trackW;
          return (
            <SvgPath
              key={m}
              d={`M ${tx} ${cy - 4} L ${tx} ${cy + 4}`}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}
        {p > 0 && (
          <SvgPath
            d={`M ${SLIDER_PAD} ${cy} L ${fillX} ${cy}`}
            stroke={theme.textSecondary}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        <SvgCircle
          cx={fillX} cy={cy} r={7}
          fill={theme.bg}
          stroke={theme.textSecondary}
          strokeWidth={2}
        />
        <SvgCircle cx={fillX} cy={cy} r={2} fill={theme.textSecondary} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width, paddingHorizontal: SLIDER_PAD - 4, marginTop: 4 }}>
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>0</Text>
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>60</Text>
      </View>
    </View>
  );
}
