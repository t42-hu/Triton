import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useMotionValue } from '@/hooks/use-motion-value';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { CalendarDays, House, ListTodo, Search, Menu, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { EventCategory } from '../domain/model';
import { FreeTimeDialog } from './free-time-dialog';
import { TodayScreen } from './today-screen';
import { StudentSearchScreen } from './student-search-screen';
import { StudentTasksScreen } from './student-tasks-screen';
import type { EventActions } from './student-event-row';

export type WorkspaceScreen = 'today' | 'calendar' | 'tasks' | 'search';
type Props = EventActions & { profileId: number; calendar: ReactNode; openNew: (category: EventCategory) => void; screen: WorkspaceScreen; openTasks: () => void; openMap: (location: string, close: () => void) => void };
const screens: { value: WorkspaceScreen; label: string; icon: LucideIcon }[] = [{ value: 'today', label: 'Mai nap', icon: House }, { value: 'calendar', label: 'Órarend', icon: CalendarDays }, { value: 'tasks', label: 'Teendők', icon: ListTodo }, { value: 'search', label: 'Keresés', icon: Search }];

/** Starts with today's useful information; timetable editing remains one tap away. */
export function StudentWorkspace(props: Props) {
  const { screen } = props; const [freeTimeOpen, setFreeTimeOpen] = useState(false);
  return <View className="gap-5">
    {screen === 'today' ? <TodayScreen {...props} openFreeTime={() => setFreeTimeOpen(true)} openTasks={props.openTasks} /> : null}
    {screen === 'calendar' ? props.calendar : null}
    {screen === 'tasks' ? <StudentTasksScreen {...props} /> : null}
    {screen === 'search' ? <StudentSearchScreen {...props} /> : null}
    {freeTimeOpen ? <FreeTimeDialog profileId={props.profileId} close={() => setFreeTimeOpen(false)} /> : null}
  </View>;
}

/** A shared underline follows navigation while each label blends into its selected color. */
export function StudentNavigation({ screen, navigate, openMenu, menuOpen = false }: { screen: WorkspaceScreen; navigate: (screen: WorkspaceScreen) => void; openMenu: () => void; menuOpen?: boolean }) {
  const [width, setWidth] = useState(0);
  const selectedIndex = menuOpen ? 4 : screens.findIndex(item => item.value === screen);
  const progress = useMotionValue(selectedIndex);
  const theme = Colors[useColorScheme()];
  const underlineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * width / 5 }] }));
  function measure(event: LayoutChangeEvent) { setWidth(event.nativeEvent.layout.width); }
  return <View className="border-t border-border bg-background px-3 pt-2 sm:border-b sm:border-t-0 sm:pt-0"><View accessibilityRole="tablist" onLayout={measure} className="relative w-full max-w-[720px] flex-row self-center">
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: 0, left: Math.max(0, width / 10 - 12), width: 24, height: 2, borderRadius: 1, backgroundColor: theme.textSecondary }, underlineStyle]} />
    {screens.map((item, index) => <NavigationButton key={item.value} label={item.label} icon={item.icon} selected={selectedIndex === index} onPress={() => navigate(item.value)} />)}
    <NavigationButton label="Menü" icon={Menu} selected={menuOpen} onPress={openMenu} />
  </View></View>;
}

function NavigationButton({ label, icon, selected, onPress }: { label: string; icon: LucideIcon; selected: boolean; onPress: () => void }) {
  const theme = Colors[useColorScheme()];
  const progress = useMotionValue(selected ? 1 : 0);
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], [`${theme.text}AA`, theme.textSecondary]) }));
  const selectedIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Button accessibilityLabel={label} role={label === 'Menü' ? 'button' : 'tab'} accessibilityState={{ selected }} variant="ghost" className="h-14 min-w-0 flex-1 flex-col gap-1 rounded-xl border-0 bg-transparent px-1 shadow-none sm:h-12 sm:flex-row sm:gap-2" onPress={onPress}>
    <View><Icon as={icon} size={19} color={`${theme.text}AA`} /><Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, selectedIconStyle]}><Icon as={icon} size={19} color={theme.textSecondary} /></Animated.View></View>
    <Animated.Text style={[{ fontSize: 12, fontWeight: selected ? '600' : '400' }, labelStyle]} numberOfLines={1}>{label}</Animated.Text>
  </Button>;
}
