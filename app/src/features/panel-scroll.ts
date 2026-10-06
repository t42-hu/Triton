import { createContext, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';

export const PanelScrollContext = createContext<() => void>(() => undefined);

/** Waits for expanded content to be laid out before revealing its final controls. */
export function usePanelScrollController() {
  const scroll = useRef<ScrollView>(null);
  const shouldRevealEnd = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(revealTimer.current), []);
  function requestRevealEnd() { shouldRevealEnd.current = true; }
  function revealEnd() {
    shouldRevealEnd.current = false;
    scroll.current?.scrollToEnd({ animated: true });
  }
  function revealExpandedContent() {
    if (!shouldRevealEnd.current) return;
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(revealEnd, 100);
  }
  return { scroll, requestRevealEnd, revealExpandedContent };
}
