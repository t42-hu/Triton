import { useEffect } from 'react';
import { onDatabaseWrite } from '../data/database';
import { reconcileWidgets } from '../data/widget-runtime';

export function useWidgets(ready: boolean, now: number, setError: (error: string) => void) {
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    function report(error: unknown) { setError(String(error)); }
    function publish() { if (!disposed) void reconcileWidgets().catch(report); }
    function update() { clearTimeout(timer); timer = setTimeout(publish, 300); }
    update();
    const unsubscribe = onDatabaseWrite(update);
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); };
  }, [ready, now, setError]);
}
