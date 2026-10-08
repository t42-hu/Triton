import { View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import type { TodayLayoutProps } from './today-layout';

/** Places the daily agenda beside supporting information at desktop reading widths. */
export function TodayLayout(props: TodayLayoutProps) {
  const { width } = useWindowDimensions();
  if (width < 1100) return <View className="gap-7">{props.heading}{props.next}{props.summary}{props.conflicts}{props.agenda}{props.deadlines}{props.tasks}{props.actions}{props.error}</View>;
  return <View testID="desktop-today" className="gap-8">
    {props.heading}
    <View className="flex-row items-start gap-8">
      <View testID="daily-agenda" className="min-w-0 flex-1 gap-8">{props.next}{props.conflicts}{props.agenda}{props.error}</View>
      <View testID="daily-overview" className="w-[296px] gap-6 border-l border-border pl-6">
        {props.summary ? <View className="gap-3"><Text className="text-sm font-semibold">A napod számokban</Text>{props.summary}</View> : null}
        {props.deadlines}{props.tasks}
        <View className="gap-3"><Text className="text-sm font-semibold">Tervezés</Text>{props.actions}</View>
      </View>
    </View>
  </View>;
}
