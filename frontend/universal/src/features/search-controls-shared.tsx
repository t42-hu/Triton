import { View } from 'react-native';
import { UsersRound } from 'lucide-react-native';
import { Choice, Field } from './controls';

export type SearchControlsProps = { query: string; setQuery: (query: string) => void; scope: string; setScope: (scope: string) => void; options: { value: string; label: string }[] };

/** Keeps native search controls in their existing order. */
export function SearchControls(props: SearchControlsProps) {
  return <View className="gap-4"><Field label="Mit keresel?" value={props.query} onChange={props.setQuery} placeholder="Tantárgy, terem, feladat, jegyzet vagy link" /><Choice fullWidth icon={UsersRound} label="Keresés profilja" value={props.scope} onChange={props.setScope} options={props.options} /></View>;
}
