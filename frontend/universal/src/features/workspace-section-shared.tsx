import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Gives each destination and content group a recognizable visual anchor. */
export function WorkspaceHeading({ icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <View className="flex-row items-center gap-3"><Icon as={icon} size={22} className="text-muted-foreground" /><View className="min-w-0 flex-1 gap-1"><Text accessibilityRole="header" className="text-2xl font-semibold tracking-tight">{title}</Text>{detail ? <Text className="text-sm text-muted-foreground">{detail}</Text> : null}</View></View>;
}

/** Icons, counts and spacing distinguish groups without repeating explanatory paragraphs. */
export function WorkspaceSection({ icon, title, count, children, action }: { icon: LucideIcon; title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <View className="gap-2"><View className="min-h-11 flex-row items-center gap-2 border-b border-border pb-2"><Icon as={icon} size={17} className="text-muted-foreground" /><Text accessibilityRole="header" className="flex-1 text-base font-semibold">{title}</Text>{count !== undefined ? <Text className="text-xs font-medium text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>{count}</Text> : null}{action}</View>{children}</View>;
}
