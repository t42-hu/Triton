import { useRef, useState } from 'react';
import { useApp } from './app-state';
import { useAuth } from './auth-state';

/** All edits are already acknowledged by the server before sign-out. */
export function useAccountSignOut() {
  const auth = useAuth();
  const { cloud } = useApp();
  const running = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (running.current) return;
    running.current = true;
    setLeaving(true); setError('');
    try { await auth.signOut(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { running.current = false; setLeaving(false); }
  }
  return { signOut, leaving, error, busy: cloud.busy || leaving };
}
