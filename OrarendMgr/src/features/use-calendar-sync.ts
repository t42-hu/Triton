import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { refreshCalendar, configureBackground } from '../data/calendar-runtime';
import { SYNC_INTERVAL } from '../data/calendar-sync';
import { useApp } from './app-state';

/** Runs once on activation and at most once per cooldown while foregrounded. */
export function useCalendarSync() {
  const app = useApp();
  const refresh = useRef(app.refresh);
  useEffect(() => { refresh.current = app.refresh; }, [app.refresh]);
  const [busy, setBusy] = useState(false);
  const [background, setBackground] = useState('');
  async function sync() {
    if (Platform.OS === 'web') return;
    setBusy(true);
    try { await refreshCalendar(); await refresh.current(); }
    catch { app.setError('Nem sikerült ellenőrizni a frissítést. A tárolt órarend megmaradt.'); }
    finally { setBusy(false); }
  }
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; });
  useEffect(() => {
    if (Platform.OS === 'web') return;
    function activated() { if (AppState.currentState === 'active') void syncRef.current(); }
    activated();
    const subscription = AppState.addEventListener('change', activated);
    const timer = setInterval(activated, SYNC_INTERVAL);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    let canceled = false;
    async function configure() {
      try { const message = await configureBackground(); if (!canceled) setBackground(message); }
      catch { if (!canceled) setBackground('A háttérfrissítés nem érhető el; megnyitáskor frissítünk.'); }
    }
    void configure();
    return () => { canceled = true; };
  }, [app.version]);
  return { busy, background, sync };
}
