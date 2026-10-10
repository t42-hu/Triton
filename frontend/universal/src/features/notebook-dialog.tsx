import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { ExternalLink, NotebookPen, Trash2, Link2, Pencil } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DisplayEvent } from '../domain/model';
import { subjectName, type NotebookLink } from '../domain/student';
import { addNotebookLink, notebookLinks, removeNotebookLink } from '../data/student-repository';
import { useApp } from './app-state';
import { Action, Field, Modal } from './controls';
import { useOptimisticRemoval } from './use-optimistic-removal';

/** Opens the same notebook from every teaching format of a subject. */
export function NotebookDialog({ event, close, learning = false }: { event: DisplayEvent; close: () => void; learning?: boolean }) {
  const app = useApp(); const [links, setLinks] = useState<NotebookLink[]>([]);
  const removal = useOptimisticRemoval<string>();
  const [title, setTitle] = useState(''); const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const isSubject = (event.category ?? 'lesson') === 'lesson';
  const name = isSubject ? subjectName(event.originalTitle) || event.title : event.title;
  useEffect(() => {
    let cancelled = false;
    async function load() { try { const rows = await notebookLinks(event, learning); if (!cancelled) setLinks(rows); } catch { if (!cancelled) setError('Nem sikerült betölteni a jegyzeteket.'); } }
    void load(); return () => { cancelled = true; };
  }, [event, app.version, learning]);
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try { await addNotebookLink(event, title, url, learning, editingId); setTitle(''); setUrl(''); setEditingId(undefined); await app.refresh(); }
    catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  async function remove(id: string) { setError(''); try { await removal.remove(id, () => removeNotebookLink(id)); await app.refresh(); if (editingId === id) { setEditingId(undefined); setTitle(''); setUrl(''); } } catch (reason) { setError(String(reason)); } }
  const visibleLinks = links.filter(link => !removal.removed.has(link.id));
  return <Modal title={learning ? "Tanulásmenedzsment-rendszer gyorslink" : "Jegyzetfüzet"} description={name} close={close}>
    <View className="flex-row items-center gap-3"><Icon as={NotebookPen} size={24} className="text-primary" /><Text className="shrink text-sm text-muted-foreground">{isSubject ? 'Közös az összes órához.' : 'Az esemény linkjei.'}</Text></View>
    {visibleLinks.map(link => <NotebookLinkRow key={link.id} link={link} remove={() => void remove(link.id)} edit={learning ? () => { setEditingId(link.id); setTitle(link.title); setUrl(link.url); setError(''); } : undefined} report={setError} />)}
    {!visibleLinks.length ? <Text className="text-muted-foreground">Még nincs mentett link.</Text> : null}
    {!learning || !visibleLinks.length || editingId ? <View className="gap-3"><Field label={learning ? "Kurzus linkje" : "Jegyzet linkje"} value={url} onChange={setUrl} placeholder={learning ? "https://moodle… vagy https://classroom.google.com/…" : "https://…"} /><Field label="Link neve (opcionális)" value={title} onChange={setTitle} placeholder={learning ? "Például: Moodle vagy Google Classroom" : "Például: Fizika jegyzetek"} />
      <Action icon={editingId ? Pencil : Link2} disabled={busy || !url.trim()} onPress={() => void save()}>{busy ? 'Mentés…' : editingId ? 'Módosítások mentése' : 'Link hozzáadása'}</Action></View> : null}
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
  </Modal>;
}

export function NotebookLinkRow({ link, remove, edit, report }: { link: NotebookLink; remove?: () => void; edit?: () => void; report: (message: string) => void }) {
  function failed(reason: unknown) { report(`Nem sikerült megnyitni a linket: ${String(reason)}`); }
  function open() { void Linking.openURL(link.url).catch(failed); }
  return <View className="flex-row items-center gap-2 border-b border-border py-2">
    <Button accessibilityLabel={`${link.title} megnyitása`} variant="ghost" className="h-auto min-h-12 flex-1 justify-start px-1 py-2" onPress={open}><Icon as={ExternalLink} size={17} className="shrink-0 text-primary" /><View className="min-w-0 flex-1"><Text className="font-medium" numberOfLines={2}>{link.title}</Text><Text className="text-xs text-muted-foreground" numberOfLines={1}>{link.url}</Text></View></Button>
    {edit ? <Button accessibilityLabel={`${link.title} link szerkesztése`} variant="ghost" size="icon" onPress={edit}><Icon as={Pencil} size={17} className="text-primary" /></Button> : null}
    {remove ? <Button accessibilityLabel={`${link.title} link törlése`} variant="ghost" size="icon" onPress={remove}><Icon as={Trash2} size={17} className="text-destructive" /></Button> : null}
  </View>;
}
