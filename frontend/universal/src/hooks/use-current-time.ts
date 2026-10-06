import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Refreshes countdowns and the timetable clock after resuming from the background. */
export function useCurrentTime(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    function tick() { setNow(Date.now()); }
    function activate(state: string) { if (state === 'active') tick(); }
    const timer = setInterval(tick, 30000);
    const listener = AppState.addEventListener('change', activate);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  return now;
}
