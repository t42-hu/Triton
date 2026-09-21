import { useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Action, Confirm, Field, Modal } from './controls';
import { useApp } from './app-state';
import { discardStages, publishStages, sourceById, stageSource, type StagedSource } from '../data/importer';
import { addDays, today, validateRange } from '../domain/time';

export function ImportDialog({ profileId, close }: { profileId: number; close: () => void }) {
  const app = useApp();
  const [content, setContent] = useState('');
  const [name, setName] = useState('órarend.json');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 180));
  const [stage, setStage] = useState<StagedSource>();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const controller = useRef(new AbortController());
  const staged = useRef<StagedSource[]>([]);
  useEffect(() => () => { controller.current.abort(); void discardStages(staged.current); }, []);
  async function pickFile() {
    const picked = await readPickedFile();
    if (picked) { setContent(picked.content); setName(picked.name); }
  }
  async function prepare() {
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      validateRange(from, to);
      const previous = await sourceById(`${profileId}:import`);
      const result = await stageSource({ id: `${profileId}:import`, profileId, content: content || previous?.content || '', name: content ? name : previous?.name || name,
        format: (content || previous?.content || '').trimStart().startsWith('{') ? 'json' : 'ics', isManual: 0,
        fromDate: previous && previous.fromDate < from ? previous.fromDate : from, toDate: previous && previous.toDate > to ? previous.toDate : to }, app.anchor, { signal: controller.current.signal, progress: setCount });
      if (controller.current.signal.aborted) { await discardStages([result]); return; }
      staged.current = [result]; setStage(result);
    } catch (error) { setError(String(error)); } finally { setBusy(false); }
  }
  async function accept() { try { await publishStages(staged.current); staged.current = []; await app.refresh(); close(); } catch (error) { setError(String(error)); setStage(undefined); } }
  return <Modal title="Órarend importálása" description="ICS vagy JSON. Üres tartalommal a tárolt forrás időtartománya bővíthető." close={close}>
    <Action secondary onPress={() => void pickFile().catch(error => setError(String(error)))}>Fájl kiválasztása</Action>
    <Text className="text-sm text-muted-foreground">{content ? name : 'Még nincs új fájl kiválasztva'}</Text>
    <Textarea accessibilityLabel="ICS vagy JSON tartalom" value={content} onChangeText={setContent} placeholder="Vagy illeszd be a fájl tartalmát…" className="h-24" />
    <Field label="Import kezdete (ÉÉÉÉ-HH-NN)" value={from} onChange={setFrom} /><Field label="Import vége (ÉÉÉÉ-HH-NN)" value={to} onChange={setTo} />
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    {busy ? <><Progress value={0} accessibilityLabel="Import folyamatban" /><Text>{count} feldolgozott elem</Text><Action secondary onPress={() => controller.current.abort()}>Megszakítás</Action></> : <Action onPress={() => void prepare()}>Ellenőrzés és előnézet</Action>}
    {stage ? <Confirm title="Import jóváhagyása" description={`${stage.count} alkalom. Új: ${stage.added}, eltűnik: ${stage.removed}, törlődő felülírás: ${stage.lostOverrides}. A kézi órák megmaradnak.`} accept={() => void accept()} cancel={() => { setStage(undefined); void discardStages(staged.current); staged.current = []; }} /> : null}
  </Modal>;
}

async function readPickedFile(): Promise<{ content: string; name: string } | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (asset.size && asset.size > 50000000) throw new Error('A fájl túl nagy (legfeljebb 50 MB).');
  return { content: asset.file ? await asset.file.text() : await new File(asset.uri).text(), name: asset.name };
}
