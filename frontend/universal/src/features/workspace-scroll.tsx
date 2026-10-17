import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useWorkspaceSwipeGesture } from './navigation-swipe';

type ScrollPosition = { offset: SharedValue<number>; webOffset: number; content: RefObject<View | null>; contentSize: string };
const WorkspaceScrollContext = createContext<ScrollPosition | null>(null);

/** Keeps vertical scrolling simultaneous with horizontal paging over content and empty space. */
export function WorkspaceScroll({ scrollRef, onScroll, children, contentContainerStyle, ...props }: ScrollViewProps & { scrollRef: RefObject<ScrollView | null> }) {
  const workspaceSwipe = useWorkspaceSwipeGesture();
  const verticalScroll = Gesture.Native();
  const content = useRef<View>(null);
  const offset = useSharedValue(0);
  const [webOffset, setWebOffset] = useState(0);
  const [contentSize, setContentSize] = useState('');
  if (workspaceSwipe) verticalScroll.simultaneousWithExternalGesture(workspaceSwipe);
  return <WorkspaceScrollContext.Provider value={{ offset, webOffset, content, contentSize }}><GestureDetector gesture={verticalScroll} touchAction="pan-y"><ScrollView ref={scrollRef} {...props} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }} onScroll={event => {
    offset.value = Math.max(0, event.nativeEvent.contentOffset.y);
    if (Platform.OS === 'web') setWebOffset(offset.value);
    onScroll?.(event);
  }}><View ref={content} collapsable={false} onLayout={event => setContentSize(`${event.nativeEvent.layout.width}:${event.nativeEvent.layout.height}`)} style={contentContainerStyle}>{children}</View></ScrollView></GestureDetector></WorkspaceScrollContext.Provider>;
}

/** Pins panel controls to the workspace edge, even inside a horizontal calendar strip. */
export function WorkspaceStickyHeader({ children, maximumOffset }: { children: ReactNode; maximumOffset: number }) {
  const position = useContext(WorkspaceScrollContext);
  const anchor = useRef<View>(null);
  const top = useSharedValue(0);
  const [webTop, setWebTop] = useState(0);
  const [measured, setMeasured] = useState(false);
  const offset = position?.offset;
  const content = position?.content;
  const acceptMeasurement = useCallback((_x: number, y: number) => {
    const contentTop = y;
    top.set(contentTop);
    setWebTop(contentTop);
    setMeasured(true);
  }, [top]);
  const measure = useCallback(() => {
    if (content?.current) anchor.current?.measureLayout(content.current, acceptMeasurement);
  }, [content, acceptMeasurement]);
  useLayoutEffect(measure, [measure, maximumOffset, position?.contentSize]); // Re-measure after chrome, panel or viewport resizing.
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: measured ? Math.max(0, Math.min(maximumOffset, (offset?.value ?? 0) - top.value)) : 0 }] }));
  const translateY = measured ? Math.max(0, Math.min(maximumOffset, (position?.webOffset ?? 0) - webTop)) : 0;
  return <View ref={anchor} collapsable={false} onLayout={measure} style={{ zIndex: 30 }}>
    {Platform.OS === 'web' ? <View className="border-b border-border bg-card" style={{ transform: [{ translateY }] }}>{children}</View> : <Animated.View className="border-b border-border bg-card" style={motion}>{children}</Animated.View>}
  </View>;
}
