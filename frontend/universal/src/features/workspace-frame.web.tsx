import { BrandWordmark } from '@/components/brand-wordmark';
import { useAccountSignOut } from './use-account-sign-out';
import { useAuth } from './auth-state';
import { usePanelLock } from './panel-lock';
import { Image } from 'expo-image';
import { useState, type PointerEvent } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, House, ListTodo, Search, UsersRound, Link2, Settings2, MapPinned, Plus, LogOut, type LucideIcon } from 'lucide-react-native';
import { View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePanelViewport } from './panel-viewport';
import type { WorkspaceFrameProps } from './workspace-frame';
import type { WorkspaceScreen } from './student-workspace';

const destinations: { screen: WorkspaceScreen; label: string; icon: LucideIcon }[] = [
  { screen: 'today', label: 'Ma', icon: House },
  { screen: 'calendar', label: 'Órarend', icon: CalendarDays },
  { screen: 'compare', label: 'Összevetés', icon: UsersRound },
  { screen: 'tasks', label: 'Teendők', icon: ListTodo },
  { screen: 'search', label: 'Keresés', icon: Search },
];

/** The desktop rail expands on hover without shifting the workspace. */
export function WorkspaceFrame(props: WorkspaceFrameProps) {
  const isPanelOpen = usePanelLock();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(true);
  function expandOnHover(event: PointerEvent<HTMLDivElement>) { if (event.pointerType === 'mouse') setCollapsed(false); }
  function collapseOnLeave(event: PointerEvent<HTMLDivElement>) { if (event.pointerType === 'mouse') setCollapsed(true); }
  if (width < 960) return <SafeAreaView edges={props.footer ? ['top', 'left', 'right'] : undefined} pointerEvents={isPanelOpen ? 'none' : 'auto'} aria-hidden={isPanelOpen} className="flex-1 bg-background">{props.header}{props.navigation}{props.children}{props.footer}</SafeAreaView>;
  return <View pointerEvents={isPanelOpen ? 'none' : 'auto'} aria-hidden={isPanelOpen} testID="desktop-workspace" className="flex-1 flex-row bg-background">
    <div className="relative flex w-[76px] shrink-0" onPointerEnter={expandOnHover} onPointerLeave={collapseOnLeave}><Sidebar {...props} collapsed={collapsed} /></div>
    <View className="min-w-0 flex-1"><DesktopHeader {...props} />{props.children}</View>
  </View>;
}

function Sidebar(props: WorkspaceFrameProps & { collapsed: boolean }) {
  const { user } = useAuth();
  const { signOut, busy, leaving, error } = useAccountSignOut();
  return <View testID="desktop-sidebar" style={{ width: props.collapsed ? 76 : 232 }} className="absolute inset-y-0 left-0 z-20 shrink-0 overflow-hidden border-r border-border bg-card px-4 py-6 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out">
    <View className="h-full w-[200px]">
      <View className="mb-9 h-11 w-[200px] flex-row items-center">
        <View className="w-11 shrink-0 items-center"><Image source={require('@/assets/images/triton-v15.png')} contentFit="contain" accessibilityLabel="Triton42 logó" style={{ width: 38, height: 38 }} /></View>
        <BrandWordmark aria-hidden={props.collapsed} className={`ml-1 text-[21px] font-bold tracking-tight text-foreground motion-safe:transition-opacity motion-safe:duration-150 ${props.collapsed ? 'opacity-0' : 'opacity-100'}`} />
      </View>
      <View role="navigation" accessibilityLabel="Fő navigáció" className="gap-1">
        {destinations.map(item => <SidebarItem collapsed={props.collapsed} key={item.screen} icon={item.icon} label={item.label} selected={props.screen === item.screen} onPress={() => props.navigate(item.screen)} />)}
      </View>
      <View className="mt-8 gap-1 border-t border-border pt-4">
        {props.showMap ? <SidebarItem collapsed={props.collapsed} icon={MapPinned} label="Teremtérkép" onPress={props.openMap} /> : null}
        <SidebarItem collapsed={props.collapsed} icon={Link2} label="Linkek és szinkron" onPress={props.openLinks} />
        <SidebarItem collapsed={props.collapsed} icon={Settings2} label="Beállítások" onPress={props.openSettings} />
      </View>
      {user ? <View className="mt-auto border-t border-border pt-4">
        <Button variant="ghost" accessibilityLabel="Fiók kezelése" onPress={props.openAccount} style={{ width: props.collapsed ? 44 : 200 }} className="h-12 shrink-0 justify-start gap-0 overflow-hidden rounded-lg border-0 bg-transparent p-0 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out">
          <View className="w-[200px] shrink-0 flex-row items-center">
            <View className="w-11 shrink-0 items-center"><View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent">{user.image ? <Image source={{ uri: user.image }} style={{ width: 36, height: 36 }} accessibilityLabel="Fiókkép" /> : <Text className="font-semibold text-primary">{user.email.trim().charAt(0).toUpperCase() || user.name.slice(0, 1).toUpperCase()}</Text>}</View></View>
            <View aria-hidden={props.collapsed} className={`min-w-0 flex-1 items-start pl-2 motion-safe:transition-opacity motion-safe:duration-150 ${props.collapsed ? 'opacity-0' : 'opacity-100'}`}><Text className="text-sm font-semibold" numberOfLines={1}>{user.name}</Text><Text className="text-xs text-muted-foreground" numberOfLines={1}>{user.email}</Text></View>
          </View>
        </Button>
        <View className="mt-1"><SidebarItem collapsed={props.collapsed} icon={LogOut} label={leaving ? 'Kijelentkezés…' : 'Kijelentkezés'} disabled={busy} onPress={() => void signOut()} /></View>
        {error && !props.collapsed ? <Text accessibilityRole="alert" className="px-3 pt-2 text-xs text-destructive">{error}</Text> : null}
      </View> : null}
    </View>
  </View>;
}

function SidebarItem({ icon, label, selected, onPress, collapsed, disabled = false }: { disabled?: boolean; collapsed: boolean; icon: LucideIcon; label: string; selected?: boolean; onPress: () => void }) {
  return <div title={collapsed ? label : undefined}><Button variant="ghost" accessibilityLabel={label} disabled={disabled} accessibilityState={{ selected, disabled }} aria-pressed={selected} onPress={onPress} style={{ width: collapsed ? 44 : 200 }} className={`h-11 shrink-0 justify-start gap-0 overflow-hidden rounded-lg border-0 p-0 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out ${selected ? 'bg-accent' : 'bg-transparent'}`}>
    <View className="w-[200px] shrink-0 flex-row items-center"><View className="w-11 shrink-0 items-center"><Icon as={icon} size={18} className={selected ? 'text-primary' : 'text-muted-foreground'} /></View><Text aria-hidden={collapsed} className={`pl-1 text-sm motion-safe:transition-opacity motion-safe:duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'} ${selected ? 'font-semibold text-primary' : 'text-foreground'}`}>{label}</Text></View>
  </Button></div>;
}

function DesktopHeader({ screen, create }: WorkspaceFrameProps) {
  const { measureHeader } = usePanelViewport();
  const title = destinations.find(item => item.screen === screen)?.label;
  return <View onLayout={measureHeader} className="h-[72px] flex-row items-center justify-between gap-4 border-b border-border bg-background px-8">
    <View className="gap-0.5"><Text className="text-lg font-semibold">{title}</Text></View>
    <View className="flex-row items-center gap-3">
      <Button onPress={create} accessibilityLabel="Új óra vagy esemény" className="h-10 gap-2 rounded-lg px-4">
        <Icon as={Plus} size={16} className="text-primary-foreground" /><Text className="text-sm">Új esemény</Text>
      </Button>
    </View>
  </View>;
}
