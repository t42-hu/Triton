import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { calendarUrl, fetchCalendar } from '../data/calendar-fetch';
import { discardStages, publishStages, sourceById, stageSource, type StagedSource } from '../data/importer';
import { addDays, today, validateRange } from '../domain/time';
import type { Anchor, ImportControl } from '../domain/model';
import { useApp } from './app-state';

export type ImportDraft = { mode: 'file' | 'url'; url: string; content: string; name: string; from: string; to: string };

/** Keeps cancellation and staged publication together for file and subscription imports. */
export function useImport(profileId: number, close: () => void) {
  const app = useApp();
  const [draft, setDraft] = useState<ImportDraft>({ mode: 'file', url: '', content: '', name: 'órarend.ics', from: today(), to: addDays(today(), 180) });
  const [stage, setStage] = useState<StagedSource>();
  const [busy, setBusy] = useState(false); const [count, setCount] = useState(0); const [error, setError] = useState('');
  const controller = useRef(new AbortController()); const staged = useRef<StagedSource[]>([]);
  useEffect(() => () => { controller.current.abort(); void discardStages(staged.current); }, []);
  function update(patch: Partial<ImportDraft>) { setDraft(current => ({ ...current, ...patch })); }
  async function pick() { try { const file = await readPickedFile(); if (file) update({ ...file, mode: 'file' }); } catch (error) { report(error); } }
  function report(error: unknown) { setError(error instanceof Error ? error.message : 'Az import nem sikerült.'); }
  async function prepare() {
    setBusy(true); setError(''); setCount(0); controller.current = new AbortController();
    try {
      const result = await prepareImport(profileId, draft, app.anchor, { signal: controller.current.signal, progress: setCount });
      if (controller.current.signal.aborted) { await discardStages([result]); return; }
      staged.current = [result]; setStage(result);
    } catch (error) { report(error); } finally { setBusy(false); }
  }
  async function cancelStage() { const old = staged.current; staged.current = []; setStage(undefined); await discardStages(old); }
  async function accept() {
    if (busy || !staged.current.length) return;
    setBusy(true);
    try { await publishStages(staged.current); staged.current = []; setStage(undefined); await app.refresh(); close(); }
    catch (error) { report(error); await cancelStage(); } finally { setBusy(false); }
  }
  return { draft, update, stage, busy, count, error, pick, prepare, accept, cancelStage, cancel: () => controller.current.abort(), report };
}

async function prepareImport(profileId: number, draft: ImportDraft, anchor: Anchor, control: ImportControl): Promise<StagedSource> {
  validateRange(draft.from, draft.to);
  const previous = await sourceById(`${profileId}:import`);
  const isUrl = draft.mode === 'url';
  const url = isUrl ? calendarUrl(draft.url) : '';
  const content = isUrl ? await fetchCalendar(url, control.signal) : draft.content || previous?.content || '';
  const fetchedAt = Date.now();
  const result = await stageSource({ id: `${profileId}:import`, profileId, content,
    name: isUrl ? 'Naptár-előfizetés' : draft.content ? draft.name : previous?.name || draft.name,
    format: isUrl || !content.trimStart().startsWith('{') ? 'ics' : 'json', isManual: 0,
    fromDate: previous && previous.fromDate < draft.from ? previous.fromDate : draft.from,
    toDate: previous && previous.toDate > draft.to ? previous.toDate : draft.to }, anchor, control);
  result.previousRevision = previous?.revision ?? null;
  if (isUrl) result.connection = { url, autoSync: Number(Platform.OS !== 'web'), fetchedAt };
  else if (draft.content || !previous) result.connection = null;
  return result;
}
async function readPickedFile(): Promise<{ content: string; name: string } | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (asset.size && asset.size > 50000000) throw new Error('A fájl túl nagy (legfeljebb 50 MB).');
  return { content: asset.file ? await asset.file.text() : await new File(asset.uri).text(), name: asset.name };
}
