import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { UsersRound } from 'lucide-react-native';
import { Choice, Field } from './controls';

export type SearchControlsProps = { query: string; setQuery: (query: string) => void; scope: string; setScope: (scope: string) => void; options: { value: string; label: string }[] };

/** Keeps native search controls in their existing order. */
export function SearchControls(props: SearchControlsProps) {
  return <View className="gap-4"><Field label="Keresőkifejezés" value={props.query} onChange={props.setQuery} placeholder="Tantárgy, terem, feladat vagy jegyzet" /><View className="gap-2"><Text className="text-sm font-medium">Hol keressek?</Text><Choice fullWidth icon={UsersRound} label="Keresés profilja" value={props.scope} onChange={props.setScope} options={props.options} /></View></View>;
}
