import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

type Slots = { header?: ReactNode; footer?: ReactNode; title: string };
const SetupSlots = createContext<Dispatch<SetStateAction<Slots>> | null>(null);

/** Both steps share one frame; only its scrollable form changes. */
export function SetupShell({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [slots, setSlots] = useState<Slots>({ title: 'Órarend beállítása' });
  const compact = width < 600;
  const web = Platform.OS === 'web';
  const top = (Platform.OS === 'web' ? 0 : insets.top) + 16;
  const bottom = Math.max(insets.bottom, keyboardInset) + 16;
  const panelHeight = Math.min(680, Math.max(0, height - top - bottom));
  return <SetupSlots.Provider value={setSlots}>
    <View className={`flex-1 items-center bg-background ${web ? 'setup-viewport' : ''}`} style={web ? undefined : { paddingTop: compact ? 0 : top, paddingBottom: compact ? 0 : bottom, justifyContent: compact || keyboardInset > 0 ? 'flex-start' : 'center' }}>
      <View role="dialog" accessibilityLabel={slots.title} className={web ? "setup-frame gap-5 overflow-hidden rounded-xl border border-border bg-card" : compact ? "gap-5 overflow-hidden bg-card" : "gap-5 overflow-hidden rounded-xl border border-border bg-card"} style={web ? undefined : { width: compact ? width : Math.min(width - 32, 576), height: compact ? height : panelHeight, paddingHorizontal: compact ? 20 : 32, paddingTop: compact ? top : 32, paddingBottom: compact ? bottom : 32 }}>
        {slots.header}
        <View className="min-h-0 flex-1 overflow-hidden">{children}</View>
        {slots.footer ? <View className="border-t border-border/60 pt-4">{slots.footer}</View> : null}
      </View>
    </View>
  </SetupSlots.Provider>;
}

/** The header and action slots stay mounted while the form enters from its navigation direction. */
export function SetupStep({ header, footer, title, open, backwards, children }: Slots & { open: boolean; backwards: boolean; children: ReactNode }) {
  const setSlots = useContext(SetupSlots);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const previousTitle = useRef(title);
  useLayoutEffect(() => { if (open) setSlots?.({ header, footer, title }); }, [open, header, footer, title, setSlots]);
  useEffect(() => {
    if (previousTitle.current !== title) {
      previousTitle.current = title;
      progress.set(reducedMotion ? 1 : 0);
    }
    if (!open) { progress.set(reducedMotion ? 1 : 0); return; }
    progress.set(withTiming(1, { duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }));
  }, [open, title, progress, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateX: reducedMotion ? 0 : (backwards ? -24 : 24) * (1 - progress.get()) }] }));
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} aria-hidden={!open} style={[{ flex: 1, minHeight: 0, display: open ? 'flex' : 'none' }, style]}>{children}</Animated.View>;
}
