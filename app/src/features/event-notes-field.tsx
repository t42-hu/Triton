import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/text';

function NoteLink({ link, open }: { link: string; open: (link: string) => void }) {
  return <Pressable accessibilityRole="link" className="rounded-lg hover:bg-primary/5 active:bg-primary/10" onPress={() => open(link)}><Text className="text-sm text-primary underline" numberOfLines={2}>{link}</Text></Pressable>;
}

/** Edits lesson notes and exposes their web addresses as tappable links. */
export function EventNotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState('');
  const links = [...new Set((value.match(/https?:\/\/[^\s<>]+/g) ?? []).map(link => link.replace(/[.,;!?)]*$/, '')))];
  function reportError(reason: unknown) { setError(String(reason)); }
  function open(link: string) { void Linking.openURL(link).catch(reportError); }
  return <View className="gap-1.5">
    <Text className="text-sm font-medium">Jegyzetek</Text>
    <Textarea accessibilityLabel="Jegyzetek" value={value} onChangeText={onChange} placeholder="Téma, teendők, linkek…" autoCapitalize="sentences" />
    {links.map(link => <NoteLink key={link} link={link} open={open} />)}
    {error ? <Text accessibilityRole="alert" className="text-sm text-destructive">{error}</Text> : null}
  </View>;
}
