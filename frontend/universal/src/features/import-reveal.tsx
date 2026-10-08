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
    if (reducedMotion) { progress.set(1); return; }
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }), ReduceMotion.System));
  }, [revision, delay, progress, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * 16 }, { scale: 0.985 + progress.get() * 0.015 }] }));
  return <Animated.View style={[{ width, zIndex }, style]}>{children}</Animated.View>;
}
