import { HStack, VStack, Text, Spacer, Divider } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { WidgetEvent } from '../domain/widget';

type Props = { label: string; start: number; end: number; events: WidgetEvent[]; available: boolean };
const TodayWidget = (props: Props, environment: WidgetEnvironment) => {
  'widget';
  const color = environment.colorScheme === 'dark' ? '#F0F2F5' : '#111317';
  const secondary = environment.colorScheme === 'dark' ? '#A9B6CB' : '#54657A';
  const compact = environment.widgetFamily === 'systemSmall';
  const limit = compact || environment.widgetFamily === 'systemMedium' ? 1 : 4;
  const events = props.events ?? [];
  const now = environment.date.getTime();
  return <VStack alignment="leading" spacing={8} modifiers={[widgetURL('triton://')]}>
    <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#D74444'), lineLimit(1)]}>{props.label || 'Mai nap'}</Text>
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary)]}>Most</Text>
      {props.start ? <Text timerInterval={{ lower: new Date(props.start), upper: new Date(props.end) }} countsDown={false} modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(color)]} /> : <Text modifiers={[foregroundStyle(color)]}>Triton42</Text>}
    </HStack>
    <Divider />
    {events.slice(0, limit).map((event, index) => <VStack key={index} alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#D74444'), lineLimit(1)]}>{event.start <= now && !event.allDay ? `Folyamatban · ${event.time}` : event.time}</Text>
      <Text modifiers={[font({ size: compact ? 14 : 15, weight: 'semibold' }), foregroundStyle(color), lineLimit(compact ? 2 : 1)]}>{event.title}</Text>
      {event.location ? <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>{event.location}</Text> : null}
    </VStack>)}
    {!events.length ? <Text modifiers={[font({ size: 13 }), foregroundStyle(secondary)]}>{props.available ? 'Ma nincs több esemény' : 'Nyisd meg a Triton42-t'}</Text> : null}
    <Spacer />
    {events.length > limit ? <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>+{events.length - limit} esemény ma</Text> : null}
  </VStack>;
};
export default createWidget<Props>('TritonToday', TodayWidget);
