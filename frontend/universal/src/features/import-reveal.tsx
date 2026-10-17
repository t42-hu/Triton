import { useEffect, useRef, type ReactNode } from 'react';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/** Successful imports reveal once, after fresh calendar data is available. */
export function ImportReveal({ revision, delay = 0, children, width, zIndex }: { revision: number; delay?: number; children: ReactNode; width?: number; zIndex?: number }) {
  const progress = useSharedValue(1);
  const shown = useRef(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!revision || shown.current === revision) return;
    shown.current = revision;
    if (reducedMotion) { progress.value = 1; return; }
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }), ReduceMotion.System);
  }, [revision, delay, progress, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 16 }, { scale: 0.985 + progress.value * 0.015 }] }));
  return <Animated.View style={[{ width, zIndex }, style]}>{children}</Animated.View>;
}
