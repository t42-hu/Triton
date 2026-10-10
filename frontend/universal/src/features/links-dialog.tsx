import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { CalendarDays, Copy, Link2, Plus, RefreshCw, Share2, ShieldOff, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Action, Confirm, Modal } from './controls';
import { ShareSelectionForm, defaultShareSelection } from './share-selection-form';
import { useApp } from './app-state';
import { calendarShareOptions, calendarShares, createCalendarShare, importedCalendars, removeImportedCalendar, revokeCalendarShare, type CalendarShare, type ImportedCalendar, type ShareOptions, type ShareSelection } from '@/data/calendar-links';
import { shareCalendarLink } from './share-calendar-link';
import { useOptimisticRemoval } from './use-optimistic-removal';

type Removal = { kind: 'share'; item: CalendarShare } | { kind: 'import'; item: ImportedCalendar };
/** Keeps outgoing access and incoming subscriptions in one place, without hiding destructive actions in settings. */
export function LinksDialog({ close }: { close: () => void }) {
  const { shares, imports, loading, busy, error, notice, creating, setCreating, options, selection, setSelection, removal, setRemoval, run, create, remove, share, setShares, setImports, setOptions } = useLinksModel();
  function shareItem(item: CalendarShare) { void run(() => share(item)); }
  return <Modal title="Linkek" close={close}>
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2"><Text accessibilityRole="header" className="text-lg font-semibold">Megosztott órarendek</Text><Button variant="outline" disabled={busy || !options.length} onPress={() => setCreating(current => !current)} accessibilityLabel="Új megosztási link" className="h-10"><Icon as={Plus} size={16} /><Text>Új link</Text></Button></View>
      {creating && options[0] ? <ShareSelectionForm options={options[0]} selection={selection} onChange={setSelection} busy={busy} create={() => void run(create)} /> : null}
      {!loading && !options.length ? <Text className="text-sm text-muted-foreground">Megosztani a saját profilod órarendjét tudod.</Text> : null}
      {loading ? <Text className="text-sm text-muted-foreground">Betöltés…</Text> : !shares.length ? <Text className="text-sm text-muted-foreground">Még nincs megosztási linked.</Text> : shares.map(item => <ShareRow key={item.id} item={item} busy={busy} onShare={shareItem.bind(null, item)} onRevoke={() => setRemoval({ kind: 'share', item })} />)}
    </View>
    <View className="gap-4 border-t border-border pt-5"><Text accessibilityRole="header" className="text-lg font-semibold">Importált naptárak</Text>{!imports.length && !loading ? <Text className="text-sm text-muted-foreground">Nincs importált naptárlink.</Text> : imports.map((item, index) => <View key={item.sourceId} className={`flex-row items-start gap-3 ${index < imports.length - 1 || notice || error ? 'border-b border-border pb-4' : ''}`}><Icon as={CalendarDays} size={19} className="mt-1 text-primary" /><View className="min-w-0 flex-1 gap-1"><Text className="font-medium" numberOfLines={2}>{item.name || item.profileName}</Text><Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.profileName} · {item.eventCount} esemény</Text><Text className="text-xs text-muted-foreground" numberOfLines={1}>{host(item.url)}</Text></View><Button variant="outline" size="icon" disabled={busy} accessibilityLabel={`${item.name || item.profileName} naptárlink és eseményei törlése`} onPress={() => setRemoval({ kind: 'import', item })}><Icon as={Trash2} size={17} className="text-destructive" /></Button></View>)}</View>
    {notice ? <Text accessibilityLiveRegion="polite" className="text-sm text-primary">{notice}</Text> : null}
    {error ? <View className="gap-2"><Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text><Action secondary icon={RefreshCw} disabled={busy} onPress={() => void run(async () => { setShares(await calendarShares()); setImports(await importedCalendars()); setOptions(await calendarShareOptions()); })}>Újrapróbálás</Action></View> : null}
    {removal ? <Confirm title={removal.kind === 'share' ? 'Hozzáférés visszavonása' : 'Naptárlink törlése'} description={removal.kind === 'share' ? `A(z) ${removal.item.name} linkje többé nem tölthető le és nem frissíthető. A már letöltött másolatok megmaradnak.` : `A(z) ${removal.item.name || removal.item.profileName} naptárlink és a hozzá tartozó ${removal.item.eventCount} esemény törlődik.`} busy={busy} accept={() => void run(remove)} cancel={() => { if (!busy) setRemoval(undefined); }} /> : null}
  </Modal>;
}
function message(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
function host(url: string) { try { return new URL(url).hostname; } catch { return 'Naptárlink'; } }

function useLinksModel() {
  const app = useApp();
  const importRemoval = useOptimisticRemoval<string>();
  const revocation = useOptimisticRemoval<string>();
  const { shares, setShares, imports, setImports, loading, error, setError, options, setOptions, selection, setSelection } = useLinkLists();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [removal, setRemoval] = useState<Removal>();
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }
  async function create() {
    await app.cloud.sync();
    if (!options[0]) return;
    const item = await createCalendarShare(options[0].calendarId, selection);
    setShares(current => [item, ...current]); setCreating(false);
  }
  async function share(item: CalendarShare) { if (item.url) setNotice(await shareCalendarLink(item.url)); }
  async function remove() {
    if (!removal) return;
    const selected = removal;
    setRemoval(undefined);
    if (selected.kind === 'share') {
      await revocation.remove(selected.item.id, async () => { await revokeCalendarShare(selected.item.id); });
      setShares(await calendarShares());
    }
    else {
      await importRemoval.remove(selected.item.sourceId, () => removeImportedCalendar(selected.item.sourceId));
      await app.refresh(); setImports(await importedCalendars()); setOptions(await calendarShareOptions());
    }
    setRemoval(undefined);
  }
  return { app, shares: shares.map(item => revocation.removed.has(item.id) ? { ...item, revokedAt: item.revokedAt ?? new Date().toISOString(), url: null } : item), imports: imports.filter(item => !importRemoval.removed.has(item.sourceId)), loading, busy, error, notice, creating, setCreating, options, selection, setSelection, removal, setRemoval, run, create, remove, share, setShares, setImports, setOptions };
}
function useLinkLists() {
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [imports, setImports] = useState<ImportedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<ShareOptions[]>([]);
  const [selection, setSelection] = useState<ShareSelection>({ sourceIds: [], includeManual: true, categories: [] });
  useEffect(() => loadLinkLists(setShares, setImports, setOptions, setSelection, setLoading, setError), []);
  return { shares, setShares, imports, setImports, loading, error, setError, options, setOptions, selection, setSelection };
}
function loadLinkLists(setShares: (items: CalendarShare[]) => void, setImports: (items: ImportedCalendar[]) => void, setOptions: (items: ShareOptions[]) => void, setSelection: (selection: ShareSelection) => void, setLoading: (loading: boolean) => void, setError: (error: string) => void) {
  let active = true;
  async function load() {
    const results = await Promise.allSettled([calendarShares(), importedCalendars(), calendarShareOptions()]);
    if (!active) return;
    if (results[0].status === 'fulfilled') setShares(results[0].value); else setError(message(results[0].reason));
    if (results[1].status === 'fulfilled') setImports(results[1].value); else setError(message(results[1].reason));
    if (results[2].status === 'fulfilled') { setOptions(results[2].value); if (results[2].value[0]) setSelection(defaultShareSelection(results[2].value[0])); } else setError(message(results[2].reason));
    setLoading(false);
  }
  void load(); return () => { active = false; };
}
function ShareRow({ item, busy, onShare, onRevoke }: { item: CalendarShare; busy: boolean; onShare: () => void; onRevoke: () => void }) {
  return <View className="gap-3 pb-1"><View className="flex-row items-center gap-3"><Icon as={Link2} size={19} className="text-primary" /><View className="min-w-0 flex-1 gap-1"><Text className="font-medium" numberOfLines={2}>{item.name}</Text><Text className="text-xs text-muted-foreground">{item.revokedAt ? 'Visszavonva' : item.available ? 'Aktív' : 'Másik profilhoz tartozik'} · {new Date(item.createdAt).toLocaleDateString('hu-HU')}</Text></View></View>{!item.revokedAt ? <View className="flex-row flex-wrap gap-2">{item.url ? <Button variant="outline" disabled={busy} accessibilityLabel={`${item.name} megosztási linkje`} onPress={onShare}><Icon as={Platform.OS === 'web' ? Copy : Share2} size={16} /><Text>{Platform.OS === 'web' ? 'Link másolása' : 'Megosztás'}</Text></Button> : null}<Button variant="outline" disabled={busy} accessibilityLabel={`${item.name} hozzáférésének visszavonása`} onPress={onRevoke}><Icon as={ShieldOff} size={16} className="text-destructive" /><Text>Visszavonás</Text></Button></View> : null}</View>;
}
