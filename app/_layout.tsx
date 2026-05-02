import { Stack } from 'expo-router';
import { Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { CopilotProvider } from 'react-native-copilot';
import { APP_BG, themes } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { TutorialTooltip } from '@/components/tutorial';
import { roundedSvgMaskPath } from '@/lib/tutorial/svgMask';

// Pin a comfortable tooltip width. Without this, the library auto-sizes
// against `target.x → screen edge`, which produces a tiny pill when the
// target is in the corner. Capped at 320 so we don't get a long sausage
// on wider phones.
const SCREEN_W = Dimensions.get('window').width;
const TOOLTIP_W = Math.min(SCREEN_W - 32, 320);

// Strip the library's default tooltip chrome (white box, grey rounded
// rect, padding) so our terracotta pill is the only thing painted.
const tooltipStyle = {
  backgroundColor: 'transparent',
  padding: 0,
  paddingTop: 0,
  paddingHorizontal: 0,
  borderRadius: 0,
  overflow: 'visible' as const,
  width: TOOLTIP_W,
} as const;

// Library renders a small green "1" badge by default. We don't want it.
const HiddenStepNumber = () => null;

// Strict mode flags benign reads of .value that happen when useAnimatedStyle
// captures React state (e.g. measured rects). Our animation code is correct,
// so keep the logger on warn but drop strict mode.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  // Theme-aware backdrop for the tutorial spotlight. Recomputed on theme
  // toggle — CopilotProvider re-mounts via the keyed wrapper below so
  // mid-tour theme switches don't show a stale dim color.
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];
  const backdropColor =
    themeMode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(51,52,49,0.32)';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_BG }}>
      <BottomSheetModalProvider>
        <CopilotProvider
          key={themeMode}
          backdropColor={backdropColor}
          overlay="svg"
          animationDuration={300}
          tooltipComponent={TutorialTooltip}
          tooltipStyle={tooltipStyle}
          stepNumberComponent={HiddenStepNumber}
          svgMaskPath={roundedSvgMaskPath}
          arrowColor={theme.accent}
          arrowSize={0}
          margin={8}
          stopOnOutsideClick={false}
        >
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: APP_BG } }}>
            {/* Fade everywhere — slide-from-right was poking through when
                returning from onboarding/paywall, breaking the sense of
                "the home screen is just there". */}
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="paywall" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
        </CopilotProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
