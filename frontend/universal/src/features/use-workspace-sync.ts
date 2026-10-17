import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import { synchronizeWorkspace } from '@/data/workspace-sync';
import { onDatabaseWrite } from '@/data/database';
import { isConnectionFailure } from '@/data/offline-account-model';
export function useWorkspaceSync(refresh: () => Promise<void>) {
  const [status, setStatus] = useState('Kapcsolódás…');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const running = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const retryAfterRef = useRef(0);
  const sync = useCallback(async (resolution?: 'local' | 'server') => {
    if (running.current) return running.current;
    async function execute() {
      if (mountedRef.current) { setBusy(true); setError(''); setStatus('Szinkronizálás…'); }
      try {
        await synchronizeWorkspace(resolution); await refreshRef.current(); retryAfterRef.current = 0;
        if (mountedRef.current) { setOffline(false); setConflict(false); setStatus('Minden módosítás mentve a fiókodba.'); }
      } catch (error) {
        retryAfterRef.current = Date.now() + 15000;
        if (mountedRef.current && isConnectionFailure(error)) { setOffline(true); setStatus('Offline – az adatok ezen az eszközön mentve. Kapcsolódáskor automatikusan szinkronizálunk.'); }
        if (mountedRef.current && !isConnectionFailure(error)) { setError(error instanceof Error ? error.message : String(error)); setConflict((error as { status?: number }).status === 409); setStatus('Helyben mentve – a feltöltés még nem sikerült.'); }
        throw error;
      } finally { running.current = null; if (mountedRef.current) setBusy(false); }
    }
    const promise = execute(); running.current = promise; return promise;
  }, []);
  useSyncSchedule(sync, retryAfterRef, mountedRef, setStatus);
  return { sync, status, error, conflict, offline, busy };
}

function ignoreError() {}
function useSyncSchedule(sync: () => Promise<void>, retryAfterRef: MutableRefObject<number>, mountedRef: MutableRefObject<boolean>, setStatus: (value: string) => void) {
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function report() { if (Date.now() >= retryAfterRef.current) void sync().catch(ignoreError); }
    function changed() {
      setStatus('Ezen az eszközön mentve – feltöltésre vár.');
      clearTimeout(timer); timer = setTimeout(report, 750);
    }
    function activated(state: string) { if (state === 'active') { retryAfterRef.current = 0; report(); } }
    const unsubscribe = onDatabaseWrite(changed);
    const foreground = AppState.addEventListener('change', activated);
    const interval = setInterval(report, 15000);
    return () => { mountedRef.current = false; unsubscribe(); foreground.remove(); clearInterval(interval); clearTimeout(timer); };
  }, [sync, retryAfterRef, mountedRef, setStatus]);
}
