import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ChevronDown, ChevronUp, Minus, Plus, SlidersHorizontal, Upload } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { today } from '@/domain/time';
import { useApp } from './app-state';

const quietButton = 'h-[48px] rounded-lg border-0 bg-transparent px-3 shadow-none';
const segmentList = 'h-[48px] rounded-xl border-0 bg-muted p-1';
const segment = 'min-w-0 flex-1 rounded-lg px-2';

export function TimetableToolbar({ open }: { open: (dialog: 'import' | 'manual') => void }) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 900;
  return <View testID="timetable-toolbar" className="gap-3">
    <View className={compact ? 'gap-3' : 'flex-row items-center justify-between gap-6'}>
      <View className={width / fontScale < 320 ? 'gap-2' : 'flex-row items-center justify-between gap-2'}>
        <PeriodControls />
        <ZoomControls />
      </View>
      <View className="flex-row items-center gap-2">
        <Button variant="ghost" accessibilityLabel="Importálás" className="h-[48px] rounded-lg border-border bg-transparent px-4 shadow-none" style={compact ? { flex: 1 } : undefined} onPress={() => open('import')}><Icon as={Upload} size={18} /><Text className="text-[14px]">Importálás</Text></Button>
        <Button accessibilityLabel="Új óra" className="h-[48px] rounded-lg px-4 shadow-none" style={compact ? { flex: 1 } : undefined} onPress={() => open('manual')}><Icon as={Plus} size={18} className="text-primary-foreground" /><Text className="text-[14px]">Új óra</Text></Button>
      </View>
    </View>
    <ComparisonControls compact={compact} />
  </View>;
}

function PeriodControls() {
  const { view, setView } = useApp();
  const { fontScale } = useWindowDimensions();
  return <View className="flex-row items-center gap-1">
    <Tabs value={view.mode} onValueChange={mode => setView({ mode: mode === 'day' ? 'day' : 'week' })}>
      <TabsList className={segmentList} style={{ width: 104 * fontScale }}>
        <TabsTrigger className={segment} value="day"><Text className="text-[14px]">Nap</Text></TabsTrigger>
        <TabsTrigger className={segment} value="week"><Text className="text-[14px]">Hét</Text></TabsTrigger>
      </TabsList>
    </Tabs>
    <Button variant="ghost" className={quietButton} accessibilityLabel="Ugrás a mai napra" onPress={() => setView({ leftDate: today(), rightDate: today() })}><Text className="text-[14px]">Ma</Text></Button>
  </View>;
}

function ZoomControls() {
  const { view, setView } = useApp();
  function step(amount: number) { setView(current => ({ zoom: Math.min(2.5, Math.max(0.5, Math.round((current.zoom + amount) * 100) / 100)) })); }
  return <View className="h-[48px] flex-row items-center self-start overflow-hidden rounded-xl border border-border bg-card">
    <Button variant="ghost" className="h-[46px] w-[44px] rounded-none border-0 bg-transparent p-0" accessibilityLabel="Kicsinyítés" disabled={view.zoom <= 0.5} onPress={() => step(-0.25)}><Icon as={Minus} size={17} /></Button>
    <Button variant="ghost" className="h-[46px] min-w-[56px] rounded-none border-x border-y-0 border-border bg-muted px-1" accessibilityLabel="Nagyítás visszaállítása 100 százalékra" accessibilityHint={`Jelenlegi nagyítás: ${Math.round(view.zoom * 100)} százalék`} onPress={() => setView({ zoom: 1 })}><Text className="text-center text-[13px] font-semibold text-primary" style={{ fontVariant: ['tabular-nums'] }}>{Math.round(view.zoom * 100)}%</Text></Button>
    <Button variant="ghost" className="h-[46px] w-[44px] rounded-none border-0 bg-transparent p-0" accessibilityLabel="Nagyítás" disabled={view.zoom >= 2.5} onPress={() => step(0.25)}><Icon as={Plus} size={17} /></Button>
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
    {!compact || expanded ? <View className={compact ? 'gap-2 pb-1 pt-2' : 'flex-row items-center gap-6'}>
      <Tabs value={view.arrangement} onValueChange={arrangement => setView({ arrangement: arrangement === 'row' ? 'row' : 'column' })}>
        <TabsList className={segmentList} style={{ width: compact ? '100%' : 280 }}>
          <TabsTrigger className={`${segment} px-1`} value="column"><Text className="text-center text-[13px] font-medium" numberOfLines={1}>Egymás alatt</Text></TabsTrigger>
          <TabsTrigger className={`${segment} px-1`} value="row"><Text className="text-center text-[13px] font-medium" numberOfLines={1}>Egymás mellett</Text></TabsTrigger>
        </TabsList>
      </Tabs>
      <ComparisonSwitch label="Szinkronlapozás" checked={view.sync} onChange={sync => setView({ sync, ...(sync ? { rightDate: view.leftDate } : {}) })} />
      <ComparisonSwitch label="Csak közös órák" checked={view.common} onChange={common => setView({ common, ...(common ? { rightDate: view.leftDate } : {}) })} />
    </View> : null}
  </View>;
}

function ComparisonSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <View className="min-h-[48px] flex-row items-center justify-between gap-4 px-1">
    <Text className="shrink text-[14px] text-muted-foreground">{label}</Text>
    <Switch accessibilityLabel={label} checked={checked} onCheckedChange={onChange} />
  </View>;
}
