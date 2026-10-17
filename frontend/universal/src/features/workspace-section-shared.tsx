import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Gives each destination and content group a recognizable visual anchor. */
export function WorkspaceHeading({ icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <View className="flex-row items-start gap-3 border-b border-border pb-4"><View className="mt-1 h-9 w-9 items-center justify-center rounded-xl bg-accent"><Icon as={icon} size={18} className="text-primary" /></View><View className="min-w-0 flex-1 gap-1"><Text accessibilityRole="header" className="text-[25px] font-bold tracking-tight">{title}</Text>{detail ? <Text className="text-sm leading-5 text-muted-foreground">{detail}</Text> : null}</View></View>;
}

/** Icons, counts and spacing distinguish groups without repeating explanatory paragraphs. */
export function WorkspaceSection({ icon, title, count, children, action }: { icon: LucideIcon; title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <View className="gap-2"><View className="min-h-12 flex-row items-center gap-2 border-b border-border pb-2"><Icon as={icon} size={17} className="text-primary" /><Text accessibilityRole="header" className="flex-1 text-[16px] font-bold">{title}</Text>{count !== undefined ? <Text className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>{count}</Text> : null}{action}</View>{children}</View>;
}
