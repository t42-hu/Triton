import { View } from 'react-native';
import { ClipboardCheck, MapPin, NotebookPen } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';

const features = [
  { icon: NotebookPen, title: 'Jegyzetek az óráid mellett', description: 'Minden tárgyhoz saját jegyzetfüzet.' },
  { icon: ClipboardCheck, title: 'Teendők és határidők', description: 'Beadandók, ZH-k és vizsgák egy helyen.' },
  { icon: MapPin, title: 'Találd meg a termed', description: 'Az órákhoz tartozó termek a térképen.' },
];

/** A live identity preview makes the first step useful without a decorative timetable. */
export function SetupProfilePreview({ name }: { name: string }) {
  const displayName = name.trim() || 'Saját órarendem';
  const initials = Array.from(displayName)[0]?.toLocaleUpperCase('hu-HU') || 'S';
  return <View className="gap-5">
    <View className="flex-row items-center gap-4 border-y border-border py-4">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden className="h-12 w-12 items-center justify-center rounded-lg bg-secondary"><Text className="text-2xl font-semibold text-primary">{initials}</Text></View>
      <View className="min-w-0 flex-1 gap-1"><Text className="text-xs text-muted-foreground">Profil előnézete</Text><Text numberOfLines={1} className="text-lg font-semibold">{displayName}</Text><View className="self-start"><Badge variant="secondary"><Text>Saját</Text></Badge></View></View>
    </View>
    <View className="gap-4 px-1">{features.map(feature => <View key={feature.title} className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center"><Icon as={feature.icon} size={19} className="text-muted-foreground" /></View>
      <View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-medium">{feature.title}</Text><Text className="text-xs leading-4 text-muted-foreground">{feature.description}</Text></View>
    </View>)}</View>
  </View>;
}
