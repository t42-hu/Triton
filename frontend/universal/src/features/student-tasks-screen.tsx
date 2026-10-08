import { EventColorDialog } from './event-color-editor';
import { taskColorEvent } from '../domain/task-colors';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useTaskColor } from './use-event-appearance';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Palette, ListTodo, CalendarClock, ClipboardCheck } from 'lucide-react-native';
import { WorkspaceHeading, WorkspaceSection } from './workspace-section';
import { Text } from '@/components/ui/text';
import type { DisplayEvent, EventCategory } from '../domain/model';
import type { LessonTask } from '../domain/student';
import { lessonTasks, setTaskCompleted, taskEvent, upcomingAssessments } from '../data/student-repository';
import { wallTime, dateLabel } from '../domain/time';
import { groupByBudapestDate } from '../domain/day-groups';
import { ContentMessage, ListSkeleton } from './content-state';
import { Action, Toggle } from './controls';
import { eventCategoryIcon } from './event-presentation';
import { useApp } from './app-state';
import { useCurrentTime } from '@/hooks/use-current-time';
import { TasksLayout } from './tasks-layout';
import { StudentEventRow, type EventActions } from './student-event-row';

type Props = EventActions & { profileId: number; openNew: (category: EventCategory) => void };
export function StudentTasksScreen(props: Props) {
  const app = useApp(); const [tasks, setTasks] = useState<LessonTask[]>([]); const [assessments, setAssessments] = useState<DisplayEvent[]>([]); const [error, setError] = useState(''); const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try { const [items, dates] = await Promise.all([lessonTasks(props.profileId), upcomingAssessments(props.profileId, Date.now())]); if (!cancelled) { setTasks(items); setAssessments(dates); } }
      catch { if (!cancelled) setError('Nem sikerült betölteni a feladatokat.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [props.profileId, app.version]);
  const visibleTasks = tasks.filter(task => showCompleted || !task.completed);
  return <TasksLayout
    heading={
    <WorkspaceHeading icon={ListTodo} title="Teendők" />}
    actions={<View className="flex-row flex-wrap gap-2"><Action secondary icon={eventCategoryIcon('assignment')} onPress={() => props.openNew('assignment')}>Beadandó</Action><Action secondary icon={eventCategoryIcon('test')} onPress={() => props.openNew('test')}>ZH</Action><Action secondary icon={eventCategoryIcon('exam')} onPress={() => props.openNew('exam')}>Vizsga</Action></View>}
    deadlines={<WorkspaceSection icon={CalendarClock} title="Határidők" count={assessments.length}>
    {groupByBudapestDate(assessments).map(group => <DeadlineGroup key={group.date} date={group.date} items={group.items} openEvent={props.openEvent} openNotebook={props.openNotebook} />)}
    {loading && !assessments.length ? <ListSkeleton label="Határidők betöltése…" /> : !assessments.length && !error ? <ContentMessage title="Még nincs határidő" detail="A fenti gombokkal adhatsz hozzá beadandót, ZH-t vagy vizsgát." /> : null}
    </WorkspaceSection>}
    tasks={<WorkspaceSection icon={ClipboardCheck} title="Feladatok" count={visibleTasks.length}>
    {tasks.some(task => task.completed) ? <Toggle label="Kész feladatok" checked={showCompleted} onChange={setShowCompleted} /> : null}
    {visibleTasks.map(task => <StudentTaskRow key={task.id} task={task} openEvent={props.openEvent} report={setError} />)}
    {loading && !visibleTasks.length ? <ListSkeleton label="Feladatok betöltése…" rows={2} /> : !visibleTasks.length && !error ? <ContentMessage title="Nincs megjeleníthető feladat" detail="Feladatot az óra részleteinél adhatsz hozzá." /> : null}
    </WorkspaceSection>}
    error={error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  />;
}

function DeadlineGroup({ date, items, openEvent, openNotebook }: EventActions & { date: string; items: DisplayEvent[] }) {
  return <View className="gap-1 pt-3"><Text accessibilityRole="header" className="text-xs font-medium text-muted-foreground">{dateLabel(date)}</Text>{items.map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} openEvent={openEvent} openNotebook={openNotebook} />)}</View>;
}

export function StudentTaskRow({ task, openEvent, report }: { task: LessonTask; openEvent: (event: DisplayEvent) => void; report: (message: string) => void }) {
  const app = useApp();
  const now = useCurrentTime();
  const [colorsOpen, setColorsOpen] = useState(false);
  const colorEvent = taskColorEvent(task);
  const color = useTaskColor(task.due, Boolean(task.completed), colorEvent);
  async function complete(value: boolean) { try { await setTaskCompleted(task.id, value); await app.refresh(); } catch { report('Nem sikerült menteni a feladat állapotát.'); } }
  async function open() { try { const event = await taskEvent(task); if (!event) { report('Ez az alkalom már nincs az importált órarendben. A feladatod megmaradt.'); return; } openEvent(event); } catch { report('Nem sikerült megnyitni az eseményt.'); } }
  return <View style={{ borderLeftColor: color ?? 'transparent' }} className={`gap-2 border-b border-l-2 border-b-border py-3 pl-2 ${task.completed ? 'opacity-60' : ''}`}><View className="flex-row items-center justify-between gap-2"><View className="min-w-0 flex-1"><Toggle label={task.title} checked={Boolean(task.completed)} onChange={value => void complete(value)} /></View><Button variant="ghost" size="icon" accessibilityLabel={`${task.title} színezése`} onPress={() => setColorsOpen(true)}><Icon as={Palette} size={16} className="text-muted-foreground" /></Button></View><Pressable accessibilityRole="button" className="min-h-12 justify-center gap-1 rounded-lg pl-12 hover:bg-primary/5 active:bg-primary/10" accessibilityLabel={`${task.eventTitle} kapcsolódó esemény`} onPress={() => void open()}><Text className="text-sm text-primary" numberOfLines={2}>{task.eventTitle}</Text><Text style={{ color }} className="text-xs text-muted-foreground">{wallTime(task.due).slice(0, 16).replace('T', ' ')}{!task.completed && task.due < now ? ' · Lejárt' : ''}</Text></Pressable>{colorsOpen ? <EventColorDialog event={colorEvent} close={() => setColorsOpen(false)} /> : null}</View>;
}
