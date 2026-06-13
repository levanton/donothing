import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

/**
 * The quiet large pill used on terracotta surfaces — a translucent
 * cream outline with a full-cream serif label. One source of truth for
 * the face-down gate's "back", the onboarding rehearsal's fallback, and
 * the onboarding CTAs ("continue", "done"), so they stay pixel-identical
 * instead of each re-deriving the same outline/size/colour/label combo.
 *
 * The border is intentionally translucent (0.4) while the label is full
 * cream — that contrast is the whole look, and the reason a plain
 * `color` prop on PillButton can't express it (outline colour tints
 * both border and text together).
 */
export default function GhostButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PillButton
      label={label}
      onPress={onPress}
      outline
      size="large"
      color="rgba(249, 242, 224, 0.4)"
      style={style}
      labelStyle={styles.label}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    color: palette.cream,
    fontFamily: Fonts!.serif,
  },
});
