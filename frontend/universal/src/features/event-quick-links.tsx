import { useState } from 'react';
import { View } from 'react-native';
import { GraduationCap, Navigation } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { directionsDestination } from '../domain/directions';
import { DirectionsDialog } from './directions-dialog';
import { NotebookDialog } from './notebook-dialog';
import { ActionRow, type RowAction } from './action-row';
import { useNotebookQuickLink } from './use-notebook-quick-link';

export function EventQuickLinks({ event, compact = false, actions, actionGroups }: { event: DisplayEvent; compact?: boolean; actions?: RowAction[]; actionGroups?: { learning: RowAction[]; directions: RowAction[] } }) {
  const [panel, setPanel] = useState<'directions' | 'learning' | null>(null);
  const learning = useNotebookQuickLink(event, true, () => setPanel('learning'));
  const destination = directionsDestination(event.location);
  const lesson = (event.category ?? 'lesson') === 'lesson';
  const routeAction: RowAction = { label: 'Útvonal', icon: Navigation, iconClassName: 'text-primary', secondary: true, accessibilityLabel: `${event.title}: útvonaltervezés`, onPress: () => setPanel('directions') };
  const learningAction: RowAction = { label: 'Kurzuslink', icon: GraduationCap, iconClassName: 'text-primary', secondary: true, disabled: learning.loading, accessibilityLabel: `${event.title}: Tanulásmenedzsment-rendszer gyorslink`, onPress: learning.open };
  return <View className={actions || actionGroups ? 'gap-2' : 'flex-row flex-wrap items-center gap-1'}>
    {actionGroups ? <><ActionRow actions={[...(lesson ? [learningAction] : []), ...actionGroups.learning]} /><ActionRow actions={[...(destination ? [routeAction] : []), ...actionGroups.directions]} /></> : actions ? <ActionRow actions={[...actions,
      ...(destination ? [routeAction] : []),
      ...(lesson ? [learningAction] : []),
    ]} /> : <>
      {destination ? <Button variant="ghost" size={compact ? 'icon' : 'default'} accessibilityLabel={`${event.title}: útvonaltervezés`} onPress={() => setPanel('directions')}><Icon as={Navigation} size={18} className="text-primary" />{!compact ? <Text>Útvonal</Text> : null}</Button> : null}
      {lesson ? <Button variant="ghost" disabled={learning.loading} size={compact ? 'icon' : 'default'} accessibilityLabel={`${event.title}: Tanulásmenedzsment-rendszer gyorslink`} onPress={learning.open}><Icon as={GraduationCap} size={18} className="text-primary" />{!compact ? <Text>Kurzuslink</Text> : null}</Button> : null}
    </>}
    {panel === 'directions' ? <DirectionsDialog location={event.location} close={() => setPanel(null)} /> : null}
    {panel === 'learning' ? <NotebookDialog event={event} learning close={() => setPanel(null)} /> : null}
  </View>;
}
