import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { onDatabaseWrite } from '@/data/database';
import { hasUnsyncedChanges, isCloudWrite, synchronizeWorkspace } from '@/data/workspace-sync';
export function useWorkspaceSync(refresh: () => Promise<void>) {
  const [status, setStatus] = useState('Kapcsolódás…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const running = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const sync = useCallback(async (resolution?: 'local' | 'server') => {
    if (running.current) return running.current;
    async function execute() {
      if (mounted.current) { setBusy(true); setError(''); setStatus('Szinkronizálás…'); }
      try { await synchronizeWorkspace(resolution); await refreshRef.current(); if (mounted.current) setStatus('Minden módosítás mentve a fiókodba.'); }
      catch (error) { if (mounted.current) { setError(error instanceof Error ? error.message : String(error)); setStatus('A helyi módosítások feltöltésre várnak.'); } throw error; }
      finally { running.current = null; if (mounted.current) setBusy(false); }
    }
    const promise = execute(); running.current = promise; return promise;
  }, []);
  function subscribe() {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function checkDirty() { try { if (await hasUnsyncedChanges()) report(); } catch { /* Retry at the next change. */ } }
    const report = () => { void sync().catch(() => undefined); };
    function schedule() {
      if (isCloudWrite()) return;
      clearTimeout(timer);
      timer = setTimeout(checkDirty, 1500);
    }
    const unsubscribe = onDatabaseWrite(schedule);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') report(); });
    const interval = setInterval(report, 60000);
    return () => { mounted.current = false; unsubscribe(); foreground.remove(); clearTimeout(timer); clearInterval(interval); };
  }
  useEffect(subscribe, [sync]);
  return { sync, status, error, busy };
}
