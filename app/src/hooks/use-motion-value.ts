import { useEffect } from 'react';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** Keeps interaction transitions consistent and respects the system motion preference. */
export function useMotionValue(value: number) {
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.value = withTiming(value, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
  }, [value, progress]);
  return progress;
}
