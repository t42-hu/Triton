import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import type { LessonTask } from '../domain/student';
import { addLessonTask, lessonTasks, removeLessonTask, setTaskCompleted } from '../data/student-repository';
import { useApp } from './app-state';
import { Action, Field, Toggle } from './controls';

export function LessonTasks({ event }: { event: DisplayEvent }) {
  const app = useApp(); const [tasks, setTasks] = useState<LessonTask[]>([]);
  const [title, setTitle] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() { try { const rows = await lessonTasks(event.profileId, event); if (!cancelled) setTasks(rows); } catch { if (!cancelled) setError('Nem sikerült betölteni a feladatokat.'); } }
    void load(); return () => { cancelled = true; };
  }, [event, app.version]);
  async function add() {
    if (busy) return;
    setBusy(true); setError('');
    try { await addLessonTask(event, title); setTitle(''); await app.refresh(); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  async function change(task: LessonTask, completed: boolean) { try { await setTaskCompleted(task.id, completed); await app.refresh(); } catch (reason) { setError(String(reason)); } }
  async function remove(id: string) { try { await removeLessonTask(id); await app.refresh(); } catch (reason) { setError(String(reason)); } }
  return <View className="gap-3 rounded-xl border border-border p-4">
    <Text className="font-semibold">Feladatok erre az alkalomra</Text>
    {tasks.map(task => <View key={task.id} className="flex-row items-center gap-2"><View className="min-w-0 flex-1"><Toggle label={task.title} checked={Boolean(task.completed)} onChange={completed => void change(task, completed)} /></View><Button accessibilityLabel={`${task.title} feladat törlése`} variant="ghost" size="icon" onPress={() => void remove(task.id)}><Icon as={Trash2} size={16} className="text-destructive" /></Button></View>)}
    <Field label="Új feladat" value={title} onChange={setTitle} placeholder="Például: oldd meg a 3. feladatsort" />
    <Action secondary icon={Plus} disabled={busy || !title.trim()} onPress={() => void add()}>Feladat hozzáadása</Action>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </View>;
}
