import { EventQuickLinks } from './event-quick-links';
import { useNotebookQuickLink } from './use-notebook-quick-link';
import { AnimatedDisclosure } from './animated-disclosure';
import { useEventAppearance } from './use-event-appearance';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Clock3, MapPinned, ListTodo, NotebookPen, CalendarDays, ClipboardCheck, CheckCircle2, Coffee, ChevronDown, ChevronUp, TriangleAlert, House } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { WorkspaceHeading, WorkspaceSection } from './workspace-section';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { supportsStudyLinks, type LessonTask } from '../domain/student';
import { dailyAnalysis } from '../domain/schedule-analysis';
import { clockTime, dateLabel, wallTime } from '../domain/time';
import { visibleEvents } from '../data/repository';
import { lessonTasks, upcomingAssessments } from '../data/student-repository';
import { Action } from './controls';
import { useApp } from './app-state';
import { hasMappedRoom, locationLink } from './room-location';
import { StudentEventRow, type EventActions } from './student-event-row';
import { StudentTaskRow } from './student-tasks-screen';
import { TodayLayout } from './today-layout';
import { ListSkeleton } from './content-state';

type Props = EventActions & { profileId: number; openTasks: () => void; openMap: (location: string, onClose: () => void) => void };
export function TodayScreen(props: Props) {
  const data = useTodayData(props.profileId); const analysis = dailyAnalysis(data.events, data.date);
  const next = data.events.find(event => event.kind === 'timed' && event.end > data.now && event.category !== 'assignment');
  const pendingTasks = data.tasks.filter(task => !task.completed);
  return <TodayLayout
    heading={<WorkspaceHeading icon={House} title="Mai nap" detail={dateLabel(data.date)} />}
    next={data.loading ? <ListSkeleton label="Nap betöltése…" rows={2} /> : <NextEvent event={next} now={data.now} {...props} />}
    summary={data.events.length ? <DailySummary analysis={analysis} /> : null}
    conflicts={analysis.conflicts.length ? <WorkspaceSection icon={TriangleAlert} title="Ütközések" count={analysis.conflicts.length}>{analysis.conflicts.map(item => <View className="rounded-lg border-l-2 border-destructive bg-destructive/5 px-3" key={`${item.first.sourceId}:${item.first.key}:${item.second.sourceId}:${item.second.key}`}><Text className="pt-3 text-xs font-medium text-destructive">{clockTime(item.start)}–{clockTime(item.end)}</Text><StudentEventRow event={item.first} openEvent={props.openEvent} openNotebook={props.openNotebook} /><StudentEventRow event={item.second} openEvent={props.openEvent} openNotebook={props.openNotebook} /></View>)}</WorkspaceSection> : null}
    agenda={data.events.length ? <WorkspaceSection icon={CalendarDays} title="Mai program" count={data.events.length}>{data.events.map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} openEvent={props.openEvent} openNotebook={props.openNotebook} />)}</WorkspaceSection> : null}
    deadlines={data.assessments.length ? <WorkspaceSection icon={ClipboardCheck} title="Közelgő határidők" count={data.assessments.length}>{data.assessments.slice(0, 5).map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} showDate openEvent={props.openEvent} openNotebook={props.openNotebook} />)}</WorkspaceSection> : null}
    tasks={pendingTasks.length ? <WorkspaceSection icon={ListTodo} title="Teendők" count={pendingTasks.length}>{pendingTasks.slice(0, 5).map(task => <StudentTaskRow key={task.id} task={task} openEvent={props.openEvent} report={data.setError} />)}</WorkspaceSection> : null}
    error={data.error ? <Text accessibilityRole="alert" className="text-destructive">{data.error}</Text> : null}
    actions={<View className="gap-2 border-t border-border pt-4"><Action quiet icon={ListTodo} onPress={props.openTasks}>Összes teendő megnyitása</Action></View>}
  />;

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
  const appearance = useEventAppearance(event);
  const notebook = useNotebookQuickLink(event, false, () => { if (event) openNotebook(event); });
  if (!event) return <View className="min-h-32 justify-center gap-3 rounded-2xl bg-[#122347] px-5 py-6"><View className="h-9 w-9 items-center justify-center rounded-full bg-white/10"><Icon as={CheckCircle2} size={20} color="#FFFFFF" /></View><Text className="text-lg font-semibold text-white">Mára nincs több esemény</Text><Text className="text-sm text-white/70">Használd ki a napot, vagy nézd meg a teljes órarended.</Text></View>;
  const remaining = Math.max(1, Math.ceil((event.start - now) / 60000));
  return <View style={{ borderLeftColor: appearance.color ?? appearance.urgency ?? '#6E9EF2' }} className="gap-4 rounded-2xl border-l-[5px] bg-[#122347] p-5 sm:p-6">
    <View className="flex-row items-center gap-2"><Icon as={Clock3} size={17} color="#BCD2FF" /><Text className="text-sm font-semibold text-[#BCD2FF]">{event.start <= now ? 'Most tart' : `${remaining} perc múlva`}</Text><Text className="ml-auto text-sm text-white/75" style={{ fontVariant: ['tabular-nums'] }}>{clockTime(event.start)}–{clockTime(event.end)}</Text></View>
    <Text className="text-[23px] font-bold leading-7 text-white" numberOfLines={3}>{event.title}</Text>
    {event.location && !locationLink(event.location, false) ? <Text className="text-sm text-white/75" numberOfLines={1}>{event.location}</Text> : null}
    <EventQuickLinks event={event} actions={[{ label: 'Megnyitás', icon: Clock3, onPress: () => openEvent(event) }, ...(supportsStudyLinks(event) ? [{ label: 'Jegyzetfüzet', icon: NotebookPen, quiet: true, disabled: notebook.loading, onPress: notebook.open }] : []), ...((event.category ?? 'lesson') === 'lesson' && hasMappedRoom(event.location) ? [{ label: 'Térkép', icon: MapPinned, quiet: true, onPress: () => openMap(event.location, () => undefined) }] : [])]} />
  </View>;
}


/** Keeps load visible at a glance; break details are available on demand. */
export function DailySummary({ analysis }: { analysis: ReturnType<typeof dailyAnalysis> }) {
  const [expanded, setExpanded] = useState(false);
  const minutes = Math.round(analysis.minutes);
  return <View className="gap-3"><View className="flex-row flex-wrap items-center gap-4"><View className="flex-row items-center gap-1.5"><Icon as={Clock3} size={15} className="text-muted-foreground" /><Text className="text-sm font-medium">{Math.floor(minutes / 60)} ó {minutes % 60} p</Text></View><View className="flex-row items-center gap-1.5"><Icon as={CalendarDays} size={15} className="text-muted-foreground" /><Text className="text-sm text-muted-foreground">{analysis.lessonCount} óra</Text></View>{analysis.gaps.length ? <Button variant="ghost" className="h-9 gap-1 rounded-lg border-0 bg-transparent px-1 py-0" hitSlop={4} accessibilityLabel="Lyukasórák részletei" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}><Icon as={Coffee} size={15} /><Text className="text-sm">{analysis.gaps.length} szünet</Text><Icon as={expanded ? ChevronUp : ChevronDown} size={13} /></Button> : null}</View>
    <AnimatedDisclosure expanded={expanded} gap={12}><View className="gap-2 border-l-2 border-border py-2 pl-3">{analysis.gaps.map(slot => <Text key={slot.start} className="text-sm text-muted-foreground">{clockTime(slot.start)}–{clockTime(slot.end)} · {Math.round((slot.end - slot.start) / 60000)} perc</Text>)}</View></AnimatedDisclosure>
  </View>;
}
