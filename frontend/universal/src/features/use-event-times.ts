import { useRef, useState } from 'react';
import { shiftedEnd } from '../domain/time';

/** Keeps the current event duration when the start field becomes a valid time. */
export function useEventTimes(initialStart: string, initialEnd: string) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const previousValidStart = useRef(initialStart);
  function changeStart(nextStart: string, allDay = false) {
    const nextEnd = shiftedEnd(previousValidStart.current, end, nextStart, allDay);
    setStart(nextStart);
    if (nextEnd === null) return;
    previousValidStart.current = nextStart;
    setEnd(nextEnd);
  }
  return { start, end, setEnd, changeStart };
}
