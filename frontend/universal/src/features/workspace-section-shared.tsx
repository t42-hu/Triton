import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Gives each destination and content group a recognizable visual anchor. */
export function WorkspaceHeading({ icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Icon as={icon} size={23} className="text-primary" /></View><View className="min-w-0 flex-1 gap-0.5"><Text accessibilityRole="header" className="text-2xl font-semibold">{title}</Text>{detail ? <Text className="text-sm text-muted-foreground">{detail}</Text> : null}</View></View>;
}

/** Icons, counts and spacing distinguish groups without repeating explanatory paragraphs. */
export function WorkspaceSection({ icon, title, count, children, action }: { icon: LucideIcon; title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <View className="gap-3"><View className="flex-row items-center gap-2 border-b border-border pb-3"><Icon as={icon} size={18} className="text-primary" /><Text accessibilityRole="header" className="flex-1 text-base font-semibold">{title}</Text>{count !== undefined ? <View className="min-w-6 items-center rounded-full bg-muted px-2 py-0.5"><Text className="text-xs font-medium text-muted-foreground">{count}</Text></View> : null}{action}</View>{children}</View>;
}
