import { createContext, useRef } from 'react';
import { ScrollView } from 'react-native';

export const PanelScrollContext = createContext<() => void>(() => undefined);

/** Waits for expanded content to be laid out before revealing its final controls. */
export function usePanelScrollController() {
  const scroll = useRef<ScrollView>(null);
  const shouldRevealEnd = useRef(false);
  function requestRevealEnd() { shouldRevealEnd.current = true; }
  function revealExpandedContent() {
    if (!shouldRevealEnd.current) return;
    shouldRevealEnd.current = false;
    scroll.current?.scrollToEnd({ animated: true });
  }
  return { scroll, requestRevealEnd, revealExpandedContent };
}
