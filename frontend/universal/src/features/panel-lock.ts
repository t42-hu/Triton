import { useEffect, useSyncExternalStore } from 'react';

let activePanels = 0;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function snapshot() { return activePanels > 0; }

/** Prevents navigation gestures while any visible panel owns the interaction surface. */
export function usePanelLock(): boolean { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export function useRegisterPanel(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    activePanels += 1; notify();
    return () => { activePanels -= 1; notify(); };
  }, [open]);
}
