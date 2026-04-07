import { ReactNode, useCallback, useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

interface Props {
  children: ReactNode[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  canAdvance?: boolean;
  canGoBack?: boolean;
}

export default function OnboardingPager({
  children,
  currentPage,
  setCurrentPage,
  canAdvance = true,
  canGoBack = true,
}: Props) {
  const totalPages = children.length;
  const translateX = useSharedValue(-currentPage * SCREEN_WIDTH);
  const startX = useSharedValue(0);

  // Keep translateX in sync when currentPage changes externally (goNext, auto-advance)
  useEffect(() => {
    translateX.value = withSpring(-currentPage * SCREEN_WIDTH, SPRING_CONFIG);
  }, [currentPage]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const dx = e.translationX;
      // Prevent going past first page
      if (currentPage === 0 && dx > 0 && !canGoBack) {
        translateX.value = startX.value + dx * 0.15;
        return;
      }
      // Prevent going past last page
      if (currentPage === totalPages - 1 && dx < 0) {
        translateX.value = startX.value + dx * 0.15;
        return;
      }
      // Prevent advancing when not allowed
      if (!canAdvance && dx < 0) {
        translateX.value = startX.value + dx * 0.15;
        return;
      }
      translateX.value = startX.value + dx;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      let nextPage = currentPage;

      if (dx < -SWIPE_THRESHOLD && canAdvance && currentPage < totalPages - 1) {
        nextPage = currentPage + 1;
      } else if (dx > SWIPE_THRESHOLD && (canGoBack || currentPage > 0) && currentPage > 0) {
        nextPage = currentPage - 1;
      }

      translateX.value = withSpring(-nextPage * SCREEN_WIDTH, SPRING_CONFIG);
      if (nextPage !== currentPage) {
        runOnJS(setCurrentPage)(nextPage);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.row, containerStyle, { width: totalPages * SCREEN_WIDTH }]}>
        {children.map((child, idx) => (
          <View key={idx} style={[styles.page, { width: SCREEN_WIDTH }]}>
            {child}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flex: 1,
  },
  page: {
    flex: 1,
    overflow: 'hidden',
  },
});
