import type { RefObject } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useWorkspaceSwipeGesture } from './navigation-swipe';

/** Keeps vertical scrolling simultaneous with horizontal paging over content and empty space. */
export function WorkspaceScroll({ scrollRef, ...props }: ScrollViewProps & { scrollRef: RefObject<ScrollView | null> }) {
  const workspaceSwipe = useWorkspaceSwipeGesture();
  const verticalScroll = Gesture.Native();
  if (workspaceSwipe) verticalScroll.simultaneousWithExternalGesture(workspaceSwipe);
  return <GestureDetector gesture={verticalScroll} touchAction="pan-y"><ScrollView ref={scrollRef} {...props} /></GestureDetector>;
}
