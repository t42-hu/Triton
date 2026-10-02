import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { UsersRound, Search, CalendarDays, NotebookPen, ListTodo } from 'lucide-react-native';
import { WorkspaceHeading, WorkspaceSection } from './workspace-section';
import { Text } from '@/components/ui/text';
import { searchStudentData, type SearchResults } from '../data/student-repository';
import { useApp } from './app-state';
import { Choice, Field } from './controls';
import { NotebookLinkRow } from './notebook-dialog';
import { StudentEventRow, type EventActions } from './student-event-row';
import { StudentTaskRow } from './student-tasks-screen';

/** Debounces local search and ignores late results after the query changes. */
export function StudentSearchScreen(props: EventActions & { profileId: number }) {
  const app = useApp(); const [query, setQuery] = useState(''); const [scope, setScope] = useState(String(props.profileId)); const [results, setResults] = useState<SearchResults>({ events: [], links: [], tasks: [] }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function search() {
      setLoading(true); setError('');
      try { const next = await searchStudentData(query, scope === 'all' ? undefined : Number(scope)); if (!cancelled) setResults(next); }
      catch { if (!cancelled) setError('Nem sikerült keresni a helyi adatokban.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    const timer = setTimeout(search, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, scope, app.version]);
  const count = results.events.length + results.links.length + results.tasks.length;
  return <View className="gap-4">
    <WorkspaceHeading icon={Search} title="Keresés" /><Field label="Mit keresel?" value={query} onChange={setQuery} placeholder="Tantárgy, terem, feladat, jegyzet vagy link" />
    <Choice fullWidth icon={UsersRound} label="Keresés profilja" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Minden profil' }, ...app.profileList.map(profile => ({ value: String(profile.id), label: profile.name }))]} />
    {query.trim() ? <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{loading ? 'Keresés…' : `${count} találat`}</Text> : null}
    {results.events.length ? <WorkspaceSection icon={CalendarDays} title="Események" count={results.events.length}>
    {results.events.map(event => <StudentEventRow key={`${event.sourceId}:${event.key}`} event={event} showDate openEvent={props.openEvent} openNotebook={props.openNotebook} />)}</WorkspaceSection> : null}
    {results.links.length ? <WorkspaceSection icon={NotebookPen} title="Jegyzetfüzetek" count={results.links.length}>
    {results.links.map(link => <View key={link.id}><Text className="text-xs text-muted-foreground">{link.subject}</Text><NotebookLinkRow link={link} report={setError} /></View>)}</WorkspaceSection> : null}
    {results.tasks.length ? <WorkspaceSection icon={ListTodo} title="Feladatok" count={results.tasks.length}>
    {results.tasks.map(task => <StudentTaskRow key={task.id} task={task} openEvent={props.openEvent} report={setError} />)}</WorkspaceSection> : null}
    {Math.max(results.events.length, results.links.length, results.tasks.length) >= 60 ? <Text className="text-sm text-muted-foreground">Kategóriánként az első 60 találat látható. Pontosítsd a keresést a további találatokhoz.</Text> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </View>;
}
