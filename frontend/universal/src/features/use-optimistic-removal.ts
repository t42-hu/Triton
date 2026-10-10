import { useState } from 'react';

/** Hide immediately, including while another write is queued; undo only the failed removal. */
export function useOptimisticRemoval<T extends string | number>() {
  const [removed, setRemoved] = useState<Set<T>>(() => new Set());
  function restore(id: T) { setRemoved(current => { const next = new Set(current); next.delete(id); return next; }); }
  async function remove(id: T, operation: () => Promise<void>) {
    setRemoved(current => new Set(current).add(id));
    try { await operation(); }
    catch (error) { restore(id); throw error; }
  }
  return { removed, remove, restore };
}
