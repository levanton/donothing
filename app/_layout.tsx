import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { APP_BG } from '@/lib/theme';

// Strict mode flags benign reads of .value that happen when useAnimatedStyle
// captures React state (e.g. measured rects). Our animation code is correct,
// so keep the logger on warn but drop strict mode.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_BG }}>
      <BottomSheetModalProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: APP_BG } }}>
          {/* Fade everywhere — slide-from-right was poking through when
              returning from onboarding/paywall, breaking the sense of
              "the home screen is just there". */}
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="paywall" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
