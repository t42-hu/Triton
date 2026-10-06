import type { ReactNode } from 'react';
import { View } from 'react-native';

export type TodayLayoutProps = {
  heading: ReactNode;
  next: ReactNode;
  summary: ReactNode;
  conflicts: ReactNode;
  agenda: ReactNode;
  deadlines: ReactNode;
  tasks: ReactNode;
  actions: ReactNode;
  error: ReactNode;
};

/** Keeps the native daily view in its original reading order. */
export function TodayLayout(props: TodayLayoutProps) {
  return <View className="gap-7">{props.heading}{props.next}{props.summary}{props.conflicts}{props.agenda}{props.deadlines}{props.tasks}{props.actions}{props.error}</View>;
}
