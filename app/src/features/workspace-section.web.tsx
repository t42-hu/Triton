import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { WorkspaceHeading as MobileHeading, WorkspaceSection as MobileSection } from './workspace-section-shared';

/** Uses a generous title scale on desktop and compact headings on narrow web screens. */
export function WorkspaceHeading({ icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  const { width } = useWindowDimensions();
  if (width < 960) return <MobileHeading icon={icon} title={title} detail={detail} />;
  return <View className="gap-2"><Text accessibilityRole="header" className="text-[32px] font-semibold tracking-tight">{title}</Text>{detail ? <View className="flex-row items-center gap-2"><Icon as={icon} size={15} className="text-primary" /><Text className="text-sm text-muted-foreground">{detail}</Text></View> : null}</View>;
}

/** Quiet section rules keep agenda rows and supporting lists easy to scan. */
export function WorkspaceSection({ icon, title, count, children, action }: { icon: LucideIcon; title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < 600) return <MobileSection icon={icon} title={title} count={count} action={action}>{children}</MobileSection>;
  return <View className="gap-3"><View className="flex-row items-center gap-2 border-b border-border/60 pb-3"><Icon as={icon} size={17} className="text-primary" /><Text accessibilityRole="header" className="flex-1 text-[15px] font-semibold">{title}</Text>{count !== undefined ? <Text className="text-xs tabular-nums text-muted-foreground">{count}</Text> : null}{action}</View>{children}</View>;
}
