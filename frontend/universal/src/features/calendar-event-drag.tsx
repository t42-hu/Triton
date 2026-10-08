import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { eventDrop, type DragGrid } from '../domain/event-drag';
import { clockTime, dateLabel, wallTime } from '../domain/time';
import { updateEvents } from '../data/repository';
import { useApp } from './app-state';

type DragContext = { grid: DragGrid; blockers: ReturnType<typeof Gesture.Native>[]; activeColumn: string | null; setActiveColumn: (value: string | null) => void; error: (value: string) => void; moved: (event: DisplayEvent) => void; canOpen: () => boolean; suppressOpening: (ms: number) => void; };
const Context = createContext<DragContext | null>(null);
export function CalendarDragProvider({ grid, blockers, children }: { grid: DragGrid; blockers: DragContext['blockers']; children: ReactNode }) {
  const app = useApp();
  const [lastMoved, setLastMoved] = useState<DisplayEvent | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [error, setError] = useState('');
  const blockedUntilRef = useRef(0);
  function canOpen() { return Date.now() > blockedUntilRef.current; }
  function suppressOpening(ms: number) { blockedUntilRef.current = Date.now() + ms; }
  async function undo() {
    if (!lastMoved || undoing) return;
    setUndoing(true);
    try { await updateEvents([{ event: lastMoved, patch: { start: lastMoved.start, end: lastMoved.end } }]); await app.refresh(); setLastMoved(null); }
    catch (reason) { setError(`Nem sikerült visszavonni: ${String(reason)}`); }
    finally { setUndoing(false); }
  }
  return <Context.Provider value={{ grid, blockers, activeColumn, setActiveColumn, error: setError, moved: setLastMoved, canOpen, suppressOpening }}>{children}{lastMoved ? <View className="flex-row items-center gap-2 border-t border-border px-3 py-1"><Text className="min-w-0 flex-1 text-sm">Áthelyezve: {lastMoved.title}</Text><Button variant="link" disabled={undoing} onPress={() => void undo()}><Text>Visszavonás</Text></Button></View> : null}{error ? <Text accessibilityRole="alert" className="p-3 text-sm text-destructive">{error}</Text> : null}</Context.Provider>;
}
export function useCalendarDrag() { return useContext(Context); }

export function DraggableCalendarEvent({ event, date, children, ...props }: ViewProps & { event: DisplayEvent; date: string }) {
  const context = useCalendarDrag();
  const app = useApp();
  const [preview, setPreview] = useState<ReturnType<typeof eventDrop> | null>(null);
  const [saving, setSaving] = useState(false);
  const activatedRef = useRef(false);
  if (!context) return <View {...props}>{children}</View>;
  const { grid, blockers, setActiveColumn, suppressOpening, error, moved } = context;
  function target(x: number, y: number) { return eventDrop(event, date, x, y, grid); }
  function begin() { activatedRef.current = true; setActiveColumn(date); error(''); suppressOpening(60000); }
  function move(e: { translationX: number; translationY: number }) {
    try { setPreview(target(e.translationX, e.translationY)); } catch { setPreview(null); }
  }
  async function save(x: number, y: number) {
    try {
      const drop = target(x, y);
      if (drop.start === event.start && drop.end === event.end) return;
      setSaving(true);
      await updateEvents([{ event, patch: { start: drop.start, end: drop.end } }]);
      await app.refresh();
      moved(event);
    } catch (reason) { error(`Nem sikerült áthelyezni az eseményt: ${String(reason)}`); }
    finally { setSaving(false); }
  }
  function end(e: { translationX: number; translationY: number }, success: boolean) { if (success) void save(e.translationX, e.translationY); }
  function finish() { if (!activatedRef.current) return; activatedRef.current = false; suppressOpening(350); setPreview(null); setActiveColumn(null); }
  // Continuation cards retain their original start; drag the first day's card instead.
  const startsHere = wallTime(event.start).slice(0, 10) === date;
  const fitsGrid = event.kind === 'allDay'
    ? Date.parse(wallTime(event.end).slice(0, 10)) - Date.parse(wallTime(event.start).slice(0, 10)) <= grid.days * 86400000
    : event.end - event.start <= (grid.endMinute - grid.startMinute) * 60000;
  const gesture = Gesture.Pan().enabled(!event.hidden && !saving && startsHere && fitsGrid).minDistance(8).maxPointers(1)
    .activateAfterLongPress(Platform.OS === 'web' ? 0 : 350).runOnJS(true).activeCursor('grabbing')
    // eslint-disable-next-line react-hooks/refs -- RNGH registers callbacks here; refs are read only when the gesture runs.
    .blocksExternalGesture(...blockers).onStart(begin).onUpdate(move).onEnd(end).onFinalize(finish);
  return <GestureDetector gesture={gesture} touchAction={Platform.OS === 'web' ? 'none' : 'auto'}><View {...props} collapsable={false} style={[props.style, preview ? { zIndex: 100, opacity: 0.9, transform: [{ translateX: preview.x }, { translateY: preview.y }] } : {}]}>
    {children}
    {preview ? <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 bg-primary px-1"><Text className="text-[10px] font-semibold text-primary-foreground">{dateLabel(addDropDate(date, preview.x, grid.dayWidth))} · {event.kind === 'allDay' ? 'Egész nap' : clockTime(preview.start)}</Text></View> : null}
  </View></GestureDetector>;
}
function addDropDate(date: string, x: number, width: number) { return new Date(Date.parse(date) + Math.round(x / width) * 86400000).toISOString().slice(0, 10); }
