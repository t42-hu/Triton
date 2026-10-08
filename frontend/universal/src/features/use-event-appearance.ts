import { useColorScheme } from 'nativewind';
import { readableColor } from '../domain/color-contrast';
import type { DisplayEvent } from '../domain/model';
import { eventAppearance, urgencyColor } from '../domain/event-colors';
import { useApp } from './app-state';

export function useEventAppearance(event?: DisplayEvent) {
  const { eventColors, now } = useApp();
  const dark = useColorScheme().colorScheme === 'dark';
  if (!event) return {};
  const appearance = eventAppearance(event, eventColors, now);
  const color = readableColor(appearance.color, dark);
  return { color, urgency: readableColor(appearance.urgency, dark, color) };
}
export function useTaskColor(due: number, completed: boolean, event?: DisplayEvent): string | undefined {
  const { eventColors, now } = useApp();
  const dark = useColorScheme().colorScheme === 'dark';
  if (completed) return undefined;
  if (event) return readableColor(eventAppearance({ ...event, category: 'assignment', start: due }, eventColors, now).urgency, dark);
  return readableColor(urgencyColor(due, due, now, eventColors.deadline, true), dark);
}
