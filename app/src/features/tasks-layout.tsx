import type { ReactNode } from 'react';
import { View } from 'react-native';

export type TasksLayoutProps = { heading: ReactNode; actions: ReactNode; deadlines: ReactNode; tasks: ReactNode; error: ReactNode };

/** Preserves the native task list order and spacing. */
export function TasksLayout(props: TasksLayoutProps) {
  return <View className="gap-7">{props.heading}{props.actions}{props.deadlines}{props.tasks}{props.error}</View>;
}
