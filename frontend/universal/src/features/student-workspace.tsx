import { NavigationSwipe } from './navigation-swipe';
import { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { usePanelViewport } from './panel-viewport';
import { useMotionValue } from '@/hooks/use-motion-value';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { CalendarDays, House, ListTodo, Search, UsersRound, Menu, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { EventCategory } from '../domain/model';
import { TodayScreen } from './today-screen';
import { StudentSearchScreen } from './student-search-screen';
import { StudentTasksScreen } from './student-tasks-screen';
import type { EventActions } from './student-event-row';

const NavigationIndicator = Platform.OS === 'web' ? View : Animated.View;

export type WorkspaceScreen = 'today' | 'calendar' | 'compare' | 'tasks' | 'search';
type Props = EventActions & { profileId: number; calendar: ReactNode; openNew: (category: EventCategory) => void; screen: WorkspaceScreen; openTasks: () => void; openMap: (location: string, close: () => void) => void };
const screens: { value: WorkspaceScreen; label: string; icon: LucideIcon }[] = [{ value: 'today', label: 'Ma', icon: House }, { value: 'calendar', label: 'Órarend', icon: CalendarDays }, { value: 'compare', label: 'Összevetés', icon: UsersRound }, { value: 'tasks', label: 'Teendők', icon: ListTodo }, { value: 'search', label: 'Keresés', icon: Search }];

/** Starts with today's useful information; timetable editing remains one tap away. */
export function StudentWorkspace(props: Props) {
  const { screen } = props;
  return <View className="gap-6" style={Platform.OS === 'web' && screen === 'search' ? { maxWidth: 860, width: '100%' } : undefined}>
    {screen === 'today' ? <TodayScreen {...props} openTasks={props.openTasks} /> : null}
    {screen === 'calendar' ? props.calendar : null}
    {screen === 'tasks' ? <StudentTasksScreen {...props} /> : null}
    {screen === 'search' ? <StudentSearchScreen {...props} /> : null}
  </View>;
}

/** Each tab owns its centered marker, independent of parent padding and layout coordinates. */
export function StudentNavigation({ screen, navigate, bottom = false, rail = false, openMenu }: { bottom?: boolean; rail?: boolean; screen: WorkspaceScreen; navigate: (screen: WorkspaceScreen) => void; openMenu?: () => void }) {
  const { measureNavigation } = usePanelViewport();
  const selectedIndex = screens.findIndex(item => item.value === screen);
  return <NavigationSwipe screen={screen} navigate={navigate} enabled={!rail}><View onLayout={measureNavigation} className={rail ? "w-[76px] flex-1 border-r border-border bg-card px-2 py-5" : bottom ? "border-t border-border bg-card px-1" : "border-b border-border bg-card px-2 pt-1"}><View accessibilityRole="tablist" className={rail ? "relative w-full flex-col gap-1" : bottom ? "relative w-full max-w-[760px] flex-row self-center" : "relative w-full max-w-[760px] flex-row self-center gap-1"}>
    {screens.map((item, index) => <NavigationButton key={item.value} label={item.label} icon={item.icon} selected={selectedIndex === index} rail={rail} bottom={bottom} showLabel={!bottom} iconSize={bottom ? 22 : 19} onPress={() => navigate(item.value)} />)}
    {bottom && openMenu ? <MenuNavigationButton onPress={openMenu} /> : null}
  </View></View></NavigationSwipe>;
}

function MenuNavigationButton({ onPress }: { onPress: () => void }) {
  const theme = Colors[useColorScheme()];
  return <Button accessibilityLabel="Menü" variant="ghost" size="icon" className="min-w-0 flex-1 rounded-lg border-0 px-0 pt-2 pb-4 shadow-none h-[72px] items-center justify-center flex-col bg-transparent [&_svg]:!size-[22px]" onPress={onPress}>
    <Icon as={Menu} size={22} strokeWidth={2} color={`${theme.text}AA`} />
  </Button>;
}

function NavigationButton({ label, icon, selected, rail, bottom, showLabel, iconSize, onPress }: { bottom: boolean; iconSize: number; label: string; icon: LucideIcon; selected: boolean; rail: boolean; showLabel: boolean; onPress: () => void }) {
  const theme = Colors[useColorScheme()];
  const progress = useMotionValue(selected ? 1 : 0);
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], [`${theme.text}AA`, theme.textSecondary]) }));
  const selectedIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const indicatorStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateX: -10 }, { scaleX: 0.6 + progress.value * 0.4 }] }));
  return <Button size={bottom ? "icon" : undefined} accessibilityLabel={label} role="tab" accessibilityState={{ selected }} variant="ghost" className={`min-w-0 flex-1 rounded-lg border-0 px-0.5 py-2 shadow-none ${rail ? 'h-[64px] w-full flex-col gap-1.5' : bottom ? 'h-[72px] px-0 pt-2 pb-4 flex-col items-center justify-center bg-transparent [&_svg]:!size-[22px]' : 'h-[60px] flex-col gap-1 bg-transparent sm:h-12 sm:flex-row sm:gap-2'} ${selected && rail ? 'bg-accent' : 'bg-transparent'}`} onPress={onPress}>
    <View><Icon as={icon} size={iconSize} strokeWidth={2} color={`${theme.text}AA`} /><NavigationIndicator pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, Platform.OS === 'web' ? { opacity: selected ? 1 : 0 } : selectedIconStyle]}><Icon as={icon} size={iconSize} strokeWidth={2} color={theme.textSecondary} /></NavigationIndicator></View>
    {!rail ? <NavigationIndicator pointerEvents="none" className="motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out" style={[{ position: 'absolute', bottom: 0, left: '50%', width: 20, height: 3, borderRadius: 2, backgroundColor: theme.textSecondary }, Platform.OS === 'web' ? { opacity: selected ? 1 : 0, transform: [{ translateX: -10 }, { scaleX: selected ? 1 : 0.6 }] } : indicatorStyle]} /> : null}
    {showLabel ? <Animated.Text style={[{ fontSize: rail ? 10 : 11, fontWeight: selected ? '700' : '500' }, labelStyle]} numberOfLines={1}>{label}</Animated.Text> : null}
  </Button>;
}
