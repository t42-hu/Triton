import { View } from 'react-native';
import { Text } from '@/components/ui/text';

/** Reserves the same time, title and metadata columns as the loaded agenda. */
export function ListSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return <View accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-1">
    <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{label}</Text>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      {Array.from({ length: rows }, (_, index) => <View key={index} className="min-h-20 flex-row items-center gap-3 border-b border-border py-4">
        <View className="h-4 w-14 rounded bg-muted" />
        <View className="flex-1 gap-2"><View className="h-4 w-3/4 rounded bg-muted" /><View className="h-3 w-1/2 rounded bg-muted" /></View>
      </View>)}
    </View>
  </View>;
}

export function ContentMessage({ title, detail }: { title: string; detail: string }) {
  return <View className="gap-1.5 border-l-2 border-border py-2 pl-4"><Text className="text-sm font-medium">{title}</Text><Text className="text-sm leading-5 text-muted-foreground">{detail}</Text></View>;
}
