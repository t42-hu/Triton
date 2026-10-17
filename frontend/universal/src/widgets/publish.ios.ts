import type { WidgetData } from '../domain/widget';
import { widgetAgenda, widgetBoundaries, widgetClockAnchor } from '../domain/widget';
import widget from './today-widget';
export async function publishWidget(data: WidgetData): Promise<void> {
  widget.updateTimeline(widgetBoundaries(data, Date.now()).map(at => {
    const { day, events } = widgetAgenda(data, at);
    const start = widgetClockAnchor(at);
    return { date: new Date(at), props: { label: day?.label ?? '', start, end: start + 86400000, events, available: Boolean(day) } };
  }));
}
