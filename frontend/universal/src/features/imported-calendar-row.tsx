import { useState } from 'react';
import { View } from 'react-native';
import { CalendarDays, Check, PencilLine, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { renameImportedCalendar, type ImportedCalendar } from '@/data/calendar-links';

/** Keeps renaming beside the subscription it affects, with an explicit save and cancel. */
export function ImportedCalendarRow({ item, busy, divider, onRemove, onRenamed }: { item: ImportedCalendar; busy: boolean; divider: boolean; onRemove: () => void; onRenamed: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name || item.profileName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const disabled = busy || saving;
  async function save() {
    if (disabled || !name.trim()) return;
    setSaving(true); setError('');
    try { await renameImportedCalendar(item.sourceId, name); await onRenamed(); setEditing(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Nem sikerült átnevezni a naptárat.'); }
    finally { setSaving(false); }
  }
  function edit() { setName(item.name || item.profileName); setError(''); setEditing(true); }
  return <View className={`gap-3 ${divider ? 'border-b border-border pb-4' : ''}`}>
    <View className="flex-row items-start gap-3"><Icon as={CalendarDays} size={19} className="mt-1 text-primary" /><View className="min-w-0 flex-1 gap-1">
      <Text className="font-medium" numberOfLines={2}>{item.name || item.profileName}</Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.profileName} · {item.eventCount} esemény</Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{host(item.url)}</Text>
    </View><View className="flex-row gap-2">
      {!editing ? <Button variant="outline" size="icon" disabled={disabled} accessibilityLabel={`${item.name || item.profileName} naptár átnevezése`} onPress={edit}><Icon as={PencilLine} size={17} /></Button> : null}
      <Button variant="outline" size="icon" disabled={disabled} accessibilityLabel={`${item.name || item.profileName} naptárlink és eseményei törlése`} onPress={onRemove}><Icon as={Trash2} size={17} className="text-destructive" /></Button>
    </View></View>
    {editing ? <View className="gap-3 rounded-lg bg-muted/50 p-3"><View className="gap-2"><Label nativeID={`calendar-name-${item.sourceId}`}>Naptár neve</Label><Input autoFocus editable={!saving} maxLength={120} accessibilityLabel="Naptár neve" aria-labelledby={`calendar-name-${item.sourceId}`} value={name} onChangeText={setName} onSubmitEditing={() => void save()} returnKeyType="done" /></View>
      {error ? <Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text> : null}
      <View className="flex-row justify-end gap-2"><Button variant="outline" disabled={saving} onPress={() => setEditing(false)}><Text>Mégse</Text></Button><Button disabled={disabled || !name.trim()} onPress={() => void save()}><Icon as={Check} size={16} className="text-primary-foreground" /><Text>{saving ? 'Mentés…' : 'Mentés'}</Text></Button></View>
    </View> : null}
  </View>;
}
function host(url: string) { try { return new URL(url).hostname; } catch { return 'Naptárlink'; } }
