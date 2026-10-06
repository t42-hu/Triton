import { View, useWindowDimensions } from 'react-native';
import type { TasksLayoutProps } from './tasks-layout';

/** Gives deadlines and lesson tasks independent columns on desktop. */
export function TasksLayout(props: TasksLayoutProps) {
  const { width } = useWindowDimensions();
  if (width < 1100) return <View className="gap-7">{props.heading}{props.actions}{props.deadlines}{props.tasks}{props.error}</View>;
  return <View className="gap-8">{props.heading}{props.actions}<View testID="desktop-tasks" className="flex-row items-start gap-10"><View className="min-w-0 flex-1">{props.deadlines}</View><View className="min-w-0 flex-1">{props.tasks}</View></View>{props.error}</View>;
}
