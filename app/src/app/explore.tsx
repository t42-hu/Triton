import { Link } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/** Keeps the starter's expandable-content example compatible with the installed UI primitives. */
export default function ExploreScreen() {
  return <View className="flex-1 gap-6 bg-background p-8">
    <Text className="text-2xl font-semibold">Felületi elemek</Text>
    <Collapsible><CollapsibleTrigger className="rounded border border-border p-4"><Text>Órarendkezelés</Text></CollapsibleTrigger>
      <CollapsibleContent className="p-4"><Text>A profilok, az importált órák és a helyi módosítások ezen az eszközön tárolódnak.</Text></CollapsibleContent>
    </Collapsible><Link href="/"><Text className="text-primary">Vissza az órarendhez</Text></Link>
  </View>;
}
