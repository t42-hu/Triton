import { EventQuickLinks } from './event-quick-links';
import { useNotebookQuickLink } from './use-notebook-quick-link';
import { useEventAppearance } from './use-event-appearance';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { NotebookPen } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { eventCategoryIcon } from './event-presentation';
import { categoryLabel, supportsStudyLinks } from '../domain/student';
import { directionsDestination } from '../domain/directions';
import { locationLink } from './room-location';
import { clockTime, dateLabel, wallTime } from '../domain/time';

export type EventActions = { openEvent: (event: DisplayEvent) => void; openNotebook: (event: DisplayEvent) => void };

export function StudentEventRow({ event, openEvent, openNotebook, showDate = false }: EventActions & { event: DisplayEvent; showDate?: boolean }) {
  const appearance = useEventAppearance(event);
  const notebook = useNotebookQuickLink(event, false, () => openNotebook(event));
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 420;
  const color = appearance.urgency ?? appearance.color;
  const studyLinks = supportsStudyLinks(event);
  const actions = studyLinks || directionsDestination(event.location) ? <View className={`flex-row flex-wrap items-center ${compact ? 'justify-start' : 'justify-end'}`} style={studyLinks ? { width: compact ? (Platform.OS === 'android' ? 148 : 136) : (Platform.OS === 'android' ? 100 : 92) } : undefined}><EventQuickLinks event={event} compact />{studyLinks ? <Button variant="ghost" disabled={notebook.loading} size="icon" accessibilityLabel={`${event.title} jegyzetfüzete`} onPress={notebook.open}><Icon as={NotebookPen} size={18} className="text-muted-foreground" /></Button> : null}</View> : null;
  return <View style={{ borderLeftColor: appearance.color ?? appearance.urgency ?? 'transparent' }} className="flex-row items-center gap-3 border-b border-l-2 border-b-border py-3 pl-2">
    <View className="w-14 items-start gap-1 self-start pt-1"><Text style={appearance.urgency ? { color: appearance.urgency } : undefined} className="text-sm font-semibold text-foreground" numberOfLines={1}>{event.kind === 'allDay' ? 'Egész' : clockTime(event.start)}</Text><Text className="text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>{event.kind === 'allDay' ? 'nap' : clockTime(event.end)}</Text></View>
    <View className="min-w-0 flex-1 gap-1"><Pressable accessibilityRole="button" accessibilityLabel={`${event.title} részletei`} className="min-h-12 min-w-0 justify-center gap-1.5 rounded-lg py-1 hover:bg-primary/5 active:bg-primary/10" onPress={() => openEvent(event)}>
      {showDate ? <Text style={color ? { color } : undefined} className="text-xs font-medium text-primary">{dateLabel(wallTime(event.start).slice(0, 10))}</Text> : null}
      <Text className="text-[15px] font-medium" numberOfLines={2}>{event.title}</Text>
      <View className="flex-row items-center gap-1.5"><Icon as={eventCategoryIcon(event.category ?? 'lesson')} size={12} className="text-muted-foreground" /><Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>{categoryLabel(event.category)}{event.location && !locationLink(event.location, false) ? ` · ${event.location}` : ''}</Text></View>
    </Pressable>{compact ? actions : null}</View>
    {!compact ? actions : null}
  </View>;
}
