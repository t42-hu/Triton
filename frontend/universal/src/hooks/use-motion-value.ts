import { useEffect, useRef } from 'react';
import { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Keeps interaction transitions consistent and respects the system motion preference. */
export function useMotionValue(value: number) {
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.set(withTiming(value, { duration: 130, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [value, progress]);
  return progress;
}

/** Calendar periods move together without remounting their scroll view. */
export function usePeriodTransition(period: string) {
  const previousPeriod = useRef(period);
  const progress = useSharedValue(1);
  const direction = useSharedValue(1);
  useEffect(() => {
    if (previousPeriod.current === period) return;
    direction.set(period > previousPeriod.current ? 1 : -1);
    previousPeriod.current = period;
    progress.set(0);
    progress.set(withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [period, progress, direction]);
  return useAnimatedStyle(() => ({ opacity: 0.35 + progress.get() * 0.65, transform: [{ translateX: direction.get() * (1 - progress.get()) * 12 }] }));
}
