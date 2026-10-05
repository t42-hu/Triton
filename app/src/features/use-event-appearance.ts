import type { DisplayEvent } from '../domain/model';
import { eventAppearance, urgencyColor } from '../domain/event-colors';
import { useApp } from './app-state';

export function useEventAppearance(event?: DisplayEvent) {
  const { eventColors, now } = useApp();
  if (!event) return {};
  return eventAppearance(event, eventColors, now);
}
export function useTaskColor(due: number, completed: boolean, event?: DisplayEvent): string | undefined {
  const { eventColors, now } = useApp();
  if (completed) return undefined;
  if (event) return eventAppearance({ ...event, category: 'assignment', start: due }, eventColors, now).urgency;
  return urgencyColor(due, due, now, eventColors.deadline, true);
}
