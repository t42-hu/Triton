import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Clock3, MapPinned, UsersRound, ListTodo, NotebookPen, CalendarDays, ClipboardCheck, CheckCircle2, Coffee, ChevronDown, ChevronUp, TriangleAlert, House } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { WorkspaceHeading, WorkspaceSection } from './workspace-section';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import type { LessonTask } from '../domain/student';
import { dailyAnalysis } from '../domain/schedule-analysis';
import { clockTime, dateLabel, wallTime } from '../domain/time';
import { visibleEvents } from '../data/repository';
import { lessonTasks, upcomingAssessments } from '../data/student-repository';
import { Action } from './controls';
import { useApp } from './app-state';
import { hasMappedRoom } from './room-location';
import { StudentEventRow, type EventActions } from './student-event-row';
import { StudentTaskRow } from './student-tasks-screen';

type Props = EventActions & { profileId: number; openFreeTime: () => void; openTasks: () => void; openMap: (location: string, onClose: () => void) => void };
export function TodayScreen(props: Props) {
  const data = useTodayData(props.profileId); const analysis = dailyAnalysis(data.events, data.date);
  const next = data.events.find(event => event.kind === 'timed' && event.end > data.now && event.category !== 'assignment');
  const pendingTasks = data.tasks.filter(task => !task.completed);
  return <View className="gap-7">
    <WorkspaceHeading icon={House} title="Mai nap" detail={dateLabel(data.date)} />
    {data.loading ? <Text>Nap betöltése…</Text> : <NextEvent event={next} now={data.now} {...props} />}
    {data.events.length ? <DailySummary analysis={analysis} /> : null}
    {analysis.conflicts.length ? <WorkspaceSection icon={TriangleAlert} title="Ütközések" count={analysis.conflicts.length}>{analysis.conflicts.map(item => <View className="rounded-lg border-l-2 border-destructive bg-destructive/5 px-3" key={`${item.first.sourceId}:${item.first.key}:${item.second.sourceId}:${item.second.key}`}><Text className="pt-3 text-xs font-medium text-destructive">{clockTime(item.start)}–{clockTime(item.end)}</Text><StudentEventRow event={item.first} openEvent={props.openEvent} openNotebook={props.openNotebook} /><StudentEventRow event={item.second} openEvent={props.openEvent} openNotebook={props.openNotebook} /></View>)}</WorkspaceSection> : null}
    {data.events.length ? <WorkspaceSection icon={CalendarDays} title="Mai program" count={data.events.length}>{data.events.map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} openEvent={props.openEvent} openNotebook={props.openNotebook} />)}</WorkspaceSection> : null}
    {data.assessments.length ? <WorkspaceSection icon={ClipboardCheck} title="Közelgő határidők" count={data.assessments.length}>{data.assessments.slice(0, 5).map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} showDate openEvent={props.openEvent} openNotebook={props.openNotebook} />)}</WorkspaceSection> : null}
    {pendingTasks.length ? <WorkspaceSection icon={ListTodo} title="Teendők" count={pendingTasks.length}>{pendingTasks.slice(0, 5).map(task => <StudentTaskRow key={task.id} task={task} openEvent={props.openEvent} report={data.setError} />)}</WorkspaceSection> : null}
    <View className="gap-2 border-t border-border pt-4"><Action quiet icon={ListTodo} onPress={props.openTasks}>Feladatok és határidők</Action><Action quiet icon={UsersRound} onPress={props.openFreeTime}>Közös szabad idő</Action></View>
    {data.error ? <Text accessibilityRole="alert" className="text-destructive">{data.error}</Text> : null}
  </View>;

}

function useTodayData(profileId: number) {
  const app = useApp(); const [now, setNow] = useState(Date.now); const [events, setEvents] = useState<DisplayEvent[]>([]); const [tasks, setTasks] = useState<LessonTask[]>([]); const [assessments, setAssessments] = useState<DisplayEvent[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const date = wallTime(now).slice(0, 10);
  useEffect(() => {
    function tick() { setNow(Date.now()); }
    function activate(state: string) { if (state === 'active') tick(); }
    const timer = setInterval(tick, 30000); const listener = AppState.addEventListener('change', activate);
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try { const [daily, todo, dates] = await Promise.all([visibleEvents(profileId, date, 1, false), lessonTasks(profileId), upcomingAssessments(profileId, Date.now())]); if (!cancelled) { setEvents(daily); setTasks(todo); setAssessments(dates); setError(''); } }
      catch { if (!cancelled) setError('Nem sikerült betölteni a mai napot.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [profileId, date, app.version]);
  return { now, date, events, tasks, assessments, error, setError, loading };
}

function NextEvent({ event, now, openEvent, openNotebook, openMap }: Props & { event?: DisplayEvent; now: number }) {
  if (!event) return <View className="items-center gap-3 rounded-2xl bg-muted/40 px-6 py-8"><Icon as={CheckCircle2} size={30} className="text-primary" /><Text className="text-lg font-semibold">Mára nincs több program</Text></View>;
  const remaining = Math.max(1, Math.ceil((event.start - now) / 60000));
  return <View className="gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5"><View className="flex-row items-center gap-2"><Icon as={Clock3} size={17} className="text-primary" /><Text className="text-sm font-semibold text-primary">{event.start <= now ? 'Most tart' : `${remaining} perc múlva`}</Text><Text className="ml-auto text-sm text-muted-foreground">{clockTime(event.start)}–{clockTime(event.end)}</Text></View><Text className="text-xl font-semibold" numberOfLines={3}>{event.title}</Text>{event.location ? <Text className="text-sm text-muted-foreground" numberOfLines={1}>{event.location}</Text> : null}<View className="flex-row flex-wrap gap-2"><Action icon={Clock3} onPress={() => openEvent(event)}>Megnyitás</Action><Action quiet icon={NotebookPen} onPress={() => openNotebook(event)}>Jegyzetfüzet</Action>{(event.category ?? 'lesson') === 'lesson' && hasMappedRoom(event.location) ? <Action quiet icon={MapPinned} onPress={() => openMap(event.location, () => undefined)}>Térkép</Action> : null}</View></View>;
}


/** Keeps load visible at a glance; break details are available on demand. */
export function DailySummary({ analysis }: { analysis: ReturnType<typeof dailyAnalysis> }) {
  const [expanded, setExpanded] = useState(false);
  const minutes = Math.round(analysis.minutes);
  return <View className="gap-3"><View className="flex-row flex-wrap gap-4"><View className="flex-row items-center gap-1.5"><Icon as={Clock3} size={15} className="text-muted-foreground" /><Text className="text-sm font-medium">{Math.floor(minutes / 60)} ó {minutes % 60} p</Text></View><View className="flex-row items-center gap-1.5"><Icon as={CalendarDays} size={15} className="text-muted-foreground" /><Text className="text-sm text-muted-foreground">{analysis.lessonCount} óra</Text></View>{analysis.gaps.length ? <Button variant="ghost" className="h-7 gap-1 border-0 bg-transparent px-0" accessibilityLabel="Lyukasórák részletei" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}><Icon as={Coffee} size={15} /><Text className="text-sm">{analysis.gaps.length} szünet</Text><Icon as={expanded ? ChevronUp : ChevronDown} size={13} /></Button> : null}</View>
    {expanded ? <View className="gap-2 rounded-lg bg-muted/40 p-3">{analysis.gaps.map(slot => <Text key={slot.start} className="text-sm text-muted-foreground">{clockTime(slot.start)}–{clockTime(slot.end)} · {Math.round((slot.end - slot.start) / 60000)} perc</Text>)}</View> : null}
  </View>;
}
