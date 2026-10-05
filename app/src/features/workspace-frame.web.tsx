import { Image } from 'expo-image';
import { CalendarDays, House, ListTodo, Search, Users, Settings2, MapPinned, Plus, ChevronRight, type LucideIcon } from 'lucide-react-native';
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

/** Gives desktop web a persistent workspace while keeping compact web navigation. */
export function WorkspaceFrame(props: WorkspaceFrameProps) {
  const { width } = useWindowDimensions();
  if (width < 960) return <View className="flex-1 bg-background">{props.header}{props.navigation}{props.children}{props.footer}</View>;
  return <View testID="desktop-workspace" className="flex-1 flex-row bg-background">
    <Sidebar {...props} />
    <View className="min-w-0 flex-1"><DesktopHeader {...props} />{props.children}</View>
  </View>;
}

function Sidebar(props: WorkspaceFrameProps) {
  const { profileList } = useApp();
  const profile = profileList.find(item => item.isOwn) ?? profileList[0];
  return <View role="navigation" accessibilityLabel="Fő navigáció" className="w-[216px] border-r border-border bg-card/40 px-4 py-6">
    <View className="mb-10 flex-row items-center gap-2 px-2"><Image source={require('@/assets/images/triton-v15.png')} contentFit="contain" accessibilityLabel="Triton logó" style={{ width: 38, height: 38 }} /><Text className="text-[23px] font-semibold tracking-tight">Triton</Text></View>
    <View className="gap-1.5">{destinations.map(item => <SidebarItem key={item.screen} icon={item.icon} label={item.label} selected={props.screen === item.screen} onPress={() => props.navigate(item.screen)} />)}</View>
    <View className="mt-8 gap-1.5 border-t border-border/60 pt-5"><SidebarItem icon={Users} label="Profilok" onPress={props.openProfiles} />{props.showMap ? <SidebarItem icon={MapPinned} label="Térkép" onPress={props.openMap} /> : null}<SidebarItem icon={Settings2} label="Beállítások" onPress={props.openSettings} /></View>
    {profile ? <Button variant="ghost" accessibilityLabel="Saját profil kezelése" onPress={props.openProfiles} className="mt-auto h-auto justify-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3"><View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/15"><Text className="font-semibold text-primary">{profile.name.slice(0, 1).toUpperCase()}</Text></View><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-medium" numberOfLines={1}>{profile.name}</Text><Text className="text-[11px] text-muted-foreground">Saját órarend</Text></View><Icon as={ChevronRight} size={14} className="text-muted-foreground" /></Button> : null}
  </View>;
}

function SidebarItem({ icon, label, selected = false, onPress }: { icon: LucideIcon; label: string; selected?: boolean; onPress: () => void }) {
  return <Button variant="ghost" accessibilityLabel={label} accessibilityState={{ selected }} aria-pressed={selected} onPress={onPress} className={`h-11 justify-start gap-3 rounded-xl border-0 px-3 ${selected ? 'bg-primary/10' : 'bg-transparent'}`}>
    <Icon as={icon} size={18} className={selected ? 'text-primary' : 'text-muted-foreground'} /><Text className={`text-sm ${selected ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{label}</Text>
  </Button>;
}

function DesktopHeader({ screen, create, openProfiles }: WorkspaceFrameProps) {
  const { measureHeader } = usePanelViewport();
  const { profileList } = useApp();
  const profile = profileList.find(item => item.isOwn) ?? profileList[0];
  const title = destinations.find(item => item.screen === screen)?.label;
  return <View onLayout={measureHeader} className="h-[76px] flex-row items-center justify-between gap-4 border-b border-border/60 px-8">
    <View className="flex-row items-center gap-3"><Button variant="link" accessibilityLabel="Profilok megnyitása" onPress={openProfiles} className="h-8 px-0"><Text className="text-sm text-muted-foreground">{profile?.name ?? 'Triton'}</Text></Button><Icon as={ChevronRight} size={12} className="text-muted-foreground" /><Text className="text-sm font-medium">{title}</Text></View>
    <Button onPress={create} accessibilityLabel="Új óra / esemény" className="h-10 gap-2 rounded-xl px-4"><Icon as={Plus} size={16} className="text-primary-foreground" /><Text className="text-sm">Új óra / esemény</Text></Button>
  </View>;
}
