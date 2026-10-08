import { useAccountSignOut } from './use-account-sign-out';
import { useAuth } from './auth-state';
import { usePanelLock } from './panel-lock';
import { Image } from 'expo-image';
import { useState, type PointerEvent } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, House, ListTodo, Search, Users, Settings2, MapPinned, Plus, ChevronRight, LogOut, type LucideIcon } from 'lucide-react-native';
import { View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useApp } from './app-state';
import { usePanelViewport } from './panel-viewport';
import type { WorkspaceFrameProps } from './workspace-frame';
import type { WorkspaceScreen } from './student-workspace';

const destinations: { screen: WorkspaceScreen; label: string; icon: LucideIcon }[] = [
  { screen: 'today', label: 'Mai nap', icon: House },
  { screen: 'calendar', label: 'Órarend', icon: CalendarDays },
  { screen: 'tasks', label: 'Teendők', icon: ListTodo },
  { screen: 'search', label: 'Keresés', icon: Search },
];

/** Expands the desktop icon rail over content so hover never shifts the workspace. */
export function WorkspaceFrame(props: WorkspaceFrameProps) {
  const isPanelOpen = usePanelLock();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(true);
  function toggleSidebar() { setCollapsed(current => !current); }
  function expandOnHover(event: PointerEvent<HTMLDivElement>) { if (event.pointerType !== 'mouse') return; setCollapsed(false); }
  function collapseOnLeave(event: PointerEvent<HTMLDivElement>) { if (event.pointerType !== 'mouse') return; setCollapsed(true); }
  if (width < 960) return <SafeAreaView pointerEvents={isPanelOpen ? 'none' : 'auto'} aria-hidden={isPanelOpen} className="flex-1 bg-background">{props.header}{props.navigation}{props.children}{props.footer}</SafeAreaView>;
  return <View pointerEvents={isPanelOpen ? 'none' : 'auto'} aria-hidden={isPanelOpen} testID="desktop-workspace" className="flex-1 flex-row bg-background">
    <div className="relative flex w-[76px] shrink-0" onPointerEnter={expandOnHover} onPointerLeave={collapseOnLeave}><Sidebar {...props} collapsed={collapsed} toggleSidebar={toggleSidebar} /></div>
    <View className="min-w-0 flex-1"><DesktopHeader {...props} />{props.children}</View>
  </View>;
}

function Sidebar(props: WorkspaceFrameProps & { collapsed: boolean; toggleSidebar: () => void }) {
  const { user } = useAuth();
  const { signOut, busy, leaving, error } = useAccountSignOut();
  return <View role="navigation" accessibilityLabel="Fő navigáció" testID="desktop-sidebar" style={{ width: props.collapsed ? 76 : 216 }} className="absolute inset-y-0 left-0 z-20 overflow-hidden border-r border-border bg-card px-4 py-6 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out">
    <View className="h-full w-[184px]">
    <Button variant="ghost" accessibilityLabel={props.collapsed ? 'Oldalsáv kinyitása' : 'Oldalsáv összecsukása'} aria-expanded={!props.collapsed} onPress={props.toggleSidebar} className="mb-10 h-11 justify-start gap-0 border-0 bg-transparent p-0"><View className="w-11 shrink-0 items-center"><Image source={require('@/assets/images/triton-v15.png')} contentFit="contain" accessibilityLabel="Triton42 logó" style={{ width: 38, height: 38 }} /></View><Text aria-hidden={props.collapsed} className={`ml-1 text-[23px] font-semibold tracking-tight motion-safe:transition-opacity motion-safe:duration-150 ${props.collapsed ? 'opacity-0' : 'opacity-100'}`}>Triton42</Text></Button>
    <View className="gap-1.5">{destinations.map(item => <SidebarItem collapsed={props.collapsed} key={item.screen} icon={item.icon} label={item.label} selected={props.screen === item.screen} onPress={() => props.navigate(item.screen)} />)}</View>
    <View className="mt-8 gap-1.5 border-t border-border/60 pt-5"><SidebarItem collapsed={props.collapsed} icon={Users} label="Profilok" onPress={props.openProfiles} />{props.showMap ? <SidebarItem collapsed={props.collapsed} icon={MapPinned} label="Térkép" onPress={props.openMap} /> : null}<SidebarItem collapsed={props.collapsed} icon={Settings2} label="Beállítások" onPress={props.openSettings} /></View>
    {user ? <View className="mt-auto gap-1.5"><Button variant="ghost" accessibilityLabel="Fiók kezelése" onPress={props.openAccount} style={{ width: props.collapsed ? 44 : 184 }} className="h-11 shrink-0 justify-start gap-0 overflow-hidden rounded-lg border-0 bg-transparent p-0 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out"><View className="w-[184px] shrink-0 flex-row items-center"><View className="w-[42px] shrink-0 items-center"><View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/15"><>{user.image ? <Image source={{ uri: user.image }} style={{ width: 32, height: 32, borderRadius: 8 }} accessibilityLabel="Fiókkép" /> : <Text className="font-semibold text-primary">{user.name.slice(0, 1).toUpperCase()}</Text>}</></View></View><View aria-hidden={props.collapsed} className={`w-[112px] shrink-0 gap-1 pl-2 motion-safe:transition-opacity motion-safe:duration-150 ${props.collapsed ? 'opacity-0' : 'opacity-100'}`}><Text className="text-sm font-medium" numberOfLines={1}>{user.name}</Text><Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{user.email}</Text></View><Icon as={ChevronRight} size={14} className={`text-muted-foreground ${props.collapsed ? 'opacity-0' : 'opacity-100'}`} /></View></Button><SidebarItem collapsed={props.collapsed} icon={LogOut} label={leaving ? 'Kijelentkezés…' : 'Kijelentkezés'} disabled={busy} onPress={() => void signOut()} />{error ? <Text accessibilityRole="alert" className="text-xs text-destructive" style={{ width: props.collapsed ? 44 : 184 }} numberOfLines={props.collapsed ? 3 : undefined}>{error}</Text> : null}</View> : null}
    </View>
  </View>;
}

function SidebarItem({ icon, label, selected, onPress, collapsed, disabled = false }: { disabled?: boolean; collapsed: boolean; icon: LucideIcon; label: string; selected?: boolean; onPress: () => void }) {
  return <div title={collapsed ? label : undefined}><Button variant="ghost" accessibilityLabel={label} disabled={disabled} accessibilityState={{ selected, disabled }} aria-pressed={selected} onPress={onPress} style={{ width: collapsed ? 44 : 184 }} className={`h-11 rounded-lg border-0 justify-start gap-0 overflow-hidden p-0 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out ${selected ? 'bg-accent' : 'bg-transparent'}`}>
    <View className="w-[184px] shrink-0 flex-row items-center"><View className="w-11 shrink-0 items-center"><Icon as={icon} size={18} className={selected ? 'text-primary' : 'text-muted-foreground'} /></View><Text aria-hidden={collapsed} className={`pl-1 text-sm motion-safe:transition-opacity motion-safe:duration-150 ${collapsed ? 'opacity-0' : 'opacity-100'} ${selected ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{label}</Text></View>
  </Button></div>;
}

function DesktopHeader({ screen, create, openProfiles }: WorkspaceFrameProps) {
  const { measureHeader } = usePanelViewport();
  const { profileList } = useApp();
  const profile = profileList.find(item => item.isOwn) ?? profileList[0];
  const title = destinations.find(item => item.screen === screen)?.label;
  return <View onLayout={measureHeader} className="h-[64px] flex-row items-center justify-between gap-4 border-b border-border/60 px-8">
    <View className="flex-row items-center gap-3"><Button variant="link" accessibilityLabel="Profilok megnyitása" onPress={openProfiles} className="h-8 px-0"><Text className="text-sm text-muted-foreground">{profile?.name ?? 'Triton42'}</Text></Button><Icon as={ChevronRight} size={12} className="text-muted-foreground" /><Text className="text-sm font-medium">{title}</Text></View>
    <Button onPress={create} accessibilityLabel="Új óra / esemény" className="h-10 gap-2 rounded-lg px-4"><Icon as={Plus} size={16} className="text-primary-foreground" /><Text className="text-sm">Új óra / esemény</Text></Button>
  </View>;
}
