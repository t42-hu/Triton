import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Uses a generous title scale on desktop and compact headings on narrow web screens. */
export function WorkspaceHeading({ icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  const { width } = useWindowDimensions();
  if (width < 960) return <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Icon as={icon} size={23} className="text-primary" /></View><View className="min-w-0 flex-1 gap-0.5"><Text accessibilityRole="header" className="text-2xl font-semibold">{title}</Text>{detail ? <Text className="text-sm text-muted-foreground">{detail}</Text> : null}</View></View>;
  return <View className="gap-2"><Text accessibilityRole="header" className="text-[32px] font-semibold tracking-tight">{title}</Text>{detail ? <View className="flex-row items-center gap-2"><Icon as={icon} size={15} className="text-primary" /><Text className="text-sm text-muted-foreground">{detail}</Text></View> : null}</View>;
}

/** Quiet section rules keep agenda rows and supporting lists easy to scan. */
export function WorkspaceSection({ icon, title, count, children, action }: { icon: LucideIcon; title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <View className="gap-3"><View className="flex-row items-center gap-2 border-b border-border/60 pb-3"><Icon as={icon} size={17} className="text-primary" /><Text accessibilityRole="header" className="flex-1 text-[15px] font-semibold">{title}</Text>{count !== undefined ? <Text className="text-xs tabular-nums text-muted-foreground">{count}</Text> : null}{action}</View>{children}</View>;
}
