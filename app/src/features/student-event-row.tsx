import { useEventAppearance } from './use-event-appearance';
import { Pressable, View } from 'react-native';
import { NotebookPen } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { eventCategoryIcon } from './event-presentation';
import { categoryLabel } from '../domain/student';
import { clockTime, dateLabel, wallTime } from '../domain/time';

export type EventActions = { openEvent: (event: DisplayEvent) => void; openNotebook: (event: DisplayEvent) => void };

export function StudentEventRow({ event, openEvent, openNotebook, showDate = false }: EventActions & { event: DisplayEvent; showDate?: boolean }) {
  const appearance = useEventAppearance(event);
  const color = appearance.urgency ?? appearance.color;
  return <View style={{ borderColor: color, borderWidth: color ? 1 : undefined, borderRadius: color ? 10 : undefined, paddingHorizontal: color ? 8 : undefined, marginVertical: color ? 4 : undefined, borderLeftColor: appearance.color ?? color, borderLeftWidth: appearance.color ? 3 : undefined }} className="flex-row items-center gap-3 border-b border-border py-3">
    <View className="w-12 items-center gap-1 self-start pt-1"><Text style={{ color }} className="text-sm font-semibold text-primary">{event.kind === 'allDay' ? 'Egész' : clockTime(event.start)}</Text><Text className="text-[11px] text-muted-foreground">{event.kind === 'allDay' ? 'nap' : clockTime(event.end)}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title} részletei`} className="min-w-0 flex-1 gap-1.5 rounded-lg py-1 hover:bg-primary/5 active:bg-primary/10" onPress={() => openEvent(event)}>
      {showDate ? <Text style={{ color }} className="text-xs font-medium text-primary">{dateLabel(wallTime(event.start).slice(0, 10))}</Text> : null}
      <Text className="text-[15px] font-semibold" numberOfLines={2}>{event.title}</Text>
      <View className="flex-row items-center gap-1.5"><Icon as={eventCategoryIcon(event.category ?? 'lesson')} size={12} className="text-muted-foreground" /><Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>{categoryLabel(event.category)}{event.location ? ` · ${event.location}` : ''}</Text></View>
    </Pressable>
    <Button variant="ghost" size="icon" accessibilityLabel={`${event.title} jegyzetfüzete`} onPress={() => openNotebook(event)}><Icon as={NotebookPen} size={19} className="text-primary" /></Button>
  </View>;
}
