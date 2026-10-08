import { AnimatedDisclosure } from './animated-disclosure';
import { useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { ChevronDown, ChevronUp, Minus, Plus, SlidersHorizontal, CalendarDays, CalendarRange, CalendarCheck, Rows3, Columns2, RotateCcw } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Tabs, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { today } from '@/domain/time';
import { useApp } from './app-state';

const quietButton = 'h-[48px] rounded-lg border-0 bg-transparent px-3 shadow-none';
const segmentList = 'h-[48px] rounded-lg border-0 bg-muted p-1';
const segment = 'min-w-0 flex-1 rounded-lg px-2';

export function TimetableToolbar() {
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 900;
  return <View testID="timetable-toolbar" className="gap-2"><PeriodControls /><ComparisonControls compact={compact} /></View>;
}

function PeriodControls() {
  const { view, setView } = useApp();
  const { fontScale } = useWindowDimensions();
  return <View className="flex-row items-center gap-1">
    <Tabs value={view.mode} onValueChange={mode => setView({ mode: mode === 'day' ? 'day' : 'week' })}>
      <SlidingTabsList values={['day', 'week']} className={segmentList} style={{ width: 156 * fontScale }}>
        <TabsTrigger className={segment} value="day"><Icon as={CalendarDays} size={14} /><Text className="text-[14px]">Nap</Text></TabsTrigger>
        <TabsTrigger className={segment} value="week"><Icon as={CalendarRange} size={14} /><Text className="text-[14px]">Hét</Text></TabsTrigger>
      </SlidingTabsList>
    </Tabs>
    <Button variant="ghost" className={quietButton} accessibilityLabel="Ugrás a mai napra" onPress={() => setView({ leftDate: today(), rightDate: today() })}><Icon as={CalendarCheck} size={15} /><Text className="text-[14px]">Ma</Text></Button>
  </View>;
}

export function ZoomControls() {
  const { view, setView } = useApp();
  function step(amount: number) { setView(current => ({ zoom: Math.min(2.5, Math.max(0.5, Math.round((current.zoom + amount) * 100) / 100)) })); }
  return <View className={Platform.OS === 'web' ? 'h-9 flex-row items-center self-start rounded-lg bg-muted/50' : 'h-12 flex-row items-center self-start rounded-lg bg-muted/50'}>
    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border-0 bg-transparent p-0" hitSlop={6} accessibilityLabel="Kicsinyítés" disabled={view.zoom <= 0.5} onPress={() => step(-0.25)}><Icon as={Minus} size={14} /></Button>
    <Button variant="ghost" className="h-9 min-w-[56px] gap-1 rounded-none border-0 bg-transparent px-1" accessibilityLabel="Nagyítás visszaállítása 100 százalékra" accessibilityHint={`Jelenlegi nagyítás: ${Math.round(view.zoom * 100)} százalék`} onPress={() => setView({ zoom: 1 })}><Icon as={RotateCcw} size={11} /><Text className="text-center text-xs font-medium text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>{Math.round(view.zoom * 100)}%</Text></Button>
    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border-0 bg-transparent p-0" hitSlop={6} accessibilityLabel="Nagyítás" disabled={view.zoom >= 2.5} onPress={() => step(0.25)}><Icon as={Plus} size={14} /></Button>
  </View>;
}

function ComparisonControls({ compact }: { compact: boolean }) {
  const { view, setView } = useApp();
  const [expanded, setExpanded] = useState(false);
  if (!view.openProfiles.length) return null;
  return <View className="border-t border-border pt-3">
    {compact ? <Button variant="ghost" className={`${quietButton} h-auto min-h-[48px] justify-start px-0 py-2`} accessibilityLabel="Összehasonlítás beállításai" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
      <Icon as={SlidersHorizontal} size={17} className="text-muted-foreground" /><Text className="flex-1 text-[14px] font-medium">Összehasonlítás</Text>
      <Text className="text-[12px] text-muted-foreground">{view.arrangement === 'row' ? 'Egymás mellett' : 'Egymás alatt'}</Text><Icon as={expanded ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
    </Button> : null}
    <AnimatedDisclosure expanded={!compact || expanded}><View className={compact ? 'gap-2 pb-1 pt-2' : 'flex-row items-center gap-6'}>
      <Tabs value={view.arrangement} onValueChange={arrangement => setView({ arrangement: arrangement === 'row' ? 'row' : 'column' })}>
        <SlidingTabsList values={['column', 'row']} className={segmentList} style={{ width: compact ? '100%' : 280 }}>
          <TabsTrigger className={`${segment} px-1`} value="column"><Icon as={Rows3} size={14} /><Text className="text-center text-xs font-medium" numberOfLines={1}>Egymás alatt</Text></TabsTrigger>
          <TabsTrigger className={`${segment} px-1`} value="row"><Icon as={Columns2} size={14} /><Text className="text-center text-xs font-medium" numberOfLines={1}>Egymás mellett</Text></TabsTrigger>
        </SlidingTabsList>
      </Tabs>
      <ComparisonSwitch label="Szinkronlapozás" checked={view.sync} onChange={sync => setView({ sync, ...(sync ? { rightDate: view.leftDate } : {}) })} />
      <ComparisonSwitch label="Csak közös órák" checked={view.common} onChange={common => setView({ common, ...(common ? { rightDate: view.leftDate } : {}) })} />
    </View></AnimatedDisclosure>
  </View>;
}

function ComparisonSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <View className="min-h-[48px] flex-row items-center justify-between gap-4 px-1">
    <Text className="shrink text-[14px] text-muted-foreground">{label}</Text>
    <Switch accessibilityLabel={label} checked={checked} onCheckedChange={onChange} />
  </View>;
}
