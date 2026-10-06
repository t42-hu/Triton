import { View } from 'react-native';
import { wallTime } from '../domain/time';
import { GRID_MINUTES, GRID_START } from './calendar-layout';
import { useApp } from './app-state';

/** Draws Budapest's current time across today's column and follows the zoomed grid. */
export function CurrentTimeLine({ date, zoom }: { date: string; zoom: number }) {
  const { now } = useApp();
  const wall = wallTime(now);
  if (wall.slice(0, 10) !== date) return null;
  const minutes = Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16)) - GRID_START;
  if (minutes < 0 || minutes > GRID_MINUTES) return null;
  return <View pointerEvents="none" accessibilityLabel="Aktuális idő" style={{ position: 'absolute', left: 0, right: 0, top: minutes * zoom, height: 2, backgroundColor: '#ef4444', zIndex: 20 }}>
    <View style={{ position: 'absolute', left: 0, top: -5, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ef4444' }} />
    <View style={{ position: 'absolute', right: 0, top: -5, borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#ef4444' }} />
  </View>;
}
