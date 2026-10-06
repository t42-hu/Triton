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
import { wallTime } from '../domain/time';
import { Action, Toggle } from './controls';
import { eventCategoryIcon } from './event-presentation';
import { useApp } from './app-state';
import { TasksLayout } from './tasks-layout';
import { StudentEventRow, type EventActions } from './student-event-row';

type Props = EventActions & { profileId: number; openNew: (category: EventCategory) => void };
export function StudentTasksScreen(props: Props) {
  const app = useApp(); const [tasks, setTasks] = useState<LessonTask[]>([]); const [assessments, setAssessments] = useState<DisplayEvent[]>([]); const [error, setError] = useState(''); const [showCompleted, setShowCompleted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try { const [items, dates] = await Promise.all([lessonTasks(props.profileId), upcomingAssessments(props.profileId, Date.now())]); if (!cancelled) { setTasks(items); setAssessments(dates); } }
      catch { if (!cancelled) setError('Nem sikerült betölteni a feladatokat.'); }
    }
    void load(); return () => { cancelled = true; };
  }, [props.profileId, app.version]);
  const visibleTasks = tasks.filter(task => showCompleted || !task.completed);
  return <TasksLayout
    heading={
    <WorkspaceHeading icon={ListTodo} title="Teendők" />}
    actions={<View className="flex-row flex-wrap gap-2"><Action secondary icon={eventCategoryIcon('assignment')} onPress={() => props.openNew('assignment')}>Beadandó</Action><Action secondary icon={eventCategoryIcon('test')} onPress={() => props.openNew('test')}>ZH</Action><Action secondary icon={eventCategoryIcon('exam')} onPress={() => props.openNew('exam')}>Vizsga</Action></View>}
    deadlines={<WorkspaceSection icon={CalendarClock} title="Határidők" count={assessments.length}>
    {assessments.map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} showDate openEvent={props.openEvent} openNotebook={props.openNotebook} />)}
    {!assessments.length ? <Text className="text-muted-foreground">Még nincs határidő. Hozzáadás a fenti gombokkal.</Text> : null}
    </WorkspaceSection>}
    tasks={<WorkspaceSection icon={ClipboardCheck} title="Feladatok" count={visibleTasks.length}>
    {tasks.some(task => task.completed) ? <Toggle label="Kész feladatok" checked={showCompleted} onChange={setShowCompleted} /> : null}
    {visibleTasks.map(task => <StudentTaskRow key={task.id} task={task} openEvent={props.openEvent} report={setError} />)}
    {!visibleTasks.length ? <Text className="text-muted-foreground">Feladatot az óra részleteinél adhatsz hozzá.</Text> : null}
    </WorkspaceSection>}
    error={error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  />;
}

export function StudentTaskRow({ task, openEvent, report }: { task: LessonTask; openEvent: (event: DisplayEvent) => void; report: (message: string) => void }) {
  const app = useApp();
  const [colorsOpen, setColorsOpen] = useState(false);
  const colorEvent = taskColorEvent(task);
  const color = useTaskColor(task.due, Boolean(task.completed), colorEvent);
  async function complete(value: boolean) { try { await setTaskCompleted(task.id, value); await app.refresh(); } catch { report('Nem sikerült menteni a feladat állapotát.'); } }
  async function open() { try { const event = await taskEvent(task); if (!event) { report('Ez az alkalom már nincs az importált órarendben. A feladatod megmaradt.'); return; } openEvent(event); } catch { report('Nem sikerült megnyitni az eseményt.'); } }
  return <View style={{ borderColor: color, borderWidth: color ? 1 : undefined, borderRadius: color ? 10 : undefined, paddingHorizontal: color ? 8 : undefined, marginVertical: color ? 4 : undefined }} className="gap-2 border-b border-border py-3"><View className="flex-row items-center justify-between gap-2"><View className="min-w-0 flex-1"><Toggle label={task.title} checked={Boolean(task.completed)} onChange={value => void complete(value)} /></View><Button variant="ghost" size="icon" accessibilityLabel={`${task.title} színezése`} onPress={() => setColorsOpen(true)}><Icon as={Palette} size={16} /></Button></View><Pressable accessibilityRole="button" className="rounded-lg hover:bg-primary/5 active:bg-primary/10" accessibilityLabel={`${task.eventTitle} kapcsolódó esemény`} onPress={() => void open()}><Text style={{ color }} className="text-xs text-primary">{task.eventTitle} · {wallTime(task.due).slice(0, 16).replace('T', ' ')}</Text></Pressable>{colorsOpen ? <EventColorDialog event={colorEvent} close={() => setColorsOpen(false)} /> : null}</View>;
}
