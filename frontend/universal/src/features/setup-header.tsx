import { Image } from 'expo-image';
import { View } from 'react-native';
import { ChevronLeft, ChevronRight, UserRound, CalendarArrowDown, LogIn } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** Stable branding and directional navigation for both setup steps. */
type SetupHeaderProps = { step: 0 | 1 | 2; accountLabel?: string; onStepChange?: (step: 0 | 1 | 2) => void; disabled?: boolean; canContinue?: boolean };

export function SetupHeader(props: SetupHeaderProps) {
  return <View className="gap-4">
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-row items-center gap-2.5">
        <Image source={require('@/assets/images/triton-v15.png')} contentFit="contain" style={{ width: 40, height: 40 }} accessibilityLabel="Triton42 logó" />
        <Text className="text-xl font-semibold tracking-tight">Triton42</Text>
      </View>
    </View>
    <SetupStepper {...props} />
  </View>;
}

function SetupStepper({ step, accountLabel = 'Fiók', onStepChange, disabled = false, canContinue = true }: SetupHeaderProps) {
  const arrowStyle = 'mt-0.5 h-11 w-11 rounded-lg border-border/70 bg-transparent p-0 hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10';
  const nodeProps = { step, onStepChange, disabled, canContinue, accountLabel };
  return <View className="flex-row items-start">
    {step > 0 ? <Button variant="outline" accessibilityLabel={step === 1 ? "Vissza a Fiók lépéshez" : "Vissza a Profil lépéshez"} disabled={disabled || !onStepChange} onPress={() => onStepChange?.(step === 1 ? 0 : 1)} className={arrowStyle}><Icon as={ChevronLeft} size={20} className="text-primary" aria-hidden /></Button> : <View className="h-11 w-11" />}
    <StepNode item={0} {...nodeProps} /><View pointerEvents="none" className="mt-[19px] h-px w-3 shrink-0 bg-border" /><StepNode item={1} {...nodeProps} />
    <View className="w-3 shrink-0 items-center pt-[19px]">
      <View pointerEvents="none" aria-hidden className={`h-px w-full rounded-full ${step === 2 ? 'bg-primary' : 'bg-border'}`} />
    </View>
    <StepNode item={2} {...nodeProps} />
    {step < 2 ? <Button variant="outline" accessibilityLabel="Következő lépés" disabled={disabled || !onStepChange || !canContinue} onPress={() => onStepChange?.(step === 0 ? 1 : 2)} className={arrowStyle}><Icon as={ChevronRight} size={20} className="text-primary" aria-hidden /></Button> : <View className="h-11 w-11" />}
  </View>;
}

function StepNode({ item, step, onStepChange, disabled, canContinue, accountLabel }: SetupHeaderProps & { item: 0 | 1 | 2 }) {
  const current = item === step;
  const reached = item < step;
  const label = item === 0 ? accountLabel ?? 'Fiók' : item === 1 ? 'Profil' : 'Importálás';
  return <Button variant="ghost" accessibilityLabel={`${label} lépés${current ? ', aktuális' : ''}`} accessibilityState={{ selected: current }}
    disabled={disabled || !onStepChange || (item > step && !canContinue) || (step === 0 && item === 2)} onPress={() => { if (!current) onStepChange?.(item); }}
    className="h-auto min-h-16 min-w-0 flex-1 flex-col justify-start gap-2 rounded-lg opacity-100 border-0 bg-transparent p-0 hover:bg-primary/5 active:bg-primary/10">
    <View pointerEvents="none" className={`h-10 w-10 items-center justify-center rounded-lg border ${current ? 'border-primary bg-primary' : reached ? 'border-primary/30 bg-primary/10' : 'border-border bg-background'}`}>
      <Icon as={item === 0 ? LogIn : item === 1 ? UserRound : CalendarArrowDown} size={18} className={current ? 'text-primary-foreground' : reached ? 'text-primary' : 'text-muted-foreground'} aria-hidden />
    </View>
    <Text numberOfLines={2} className={`text-center text-xs leading-4 font-semibold ${current || reached ? 'text-primary' : 'text-muted-foreground'}`}>{item === 0 ? 'Fiók' : label}</Text>
  </Button>;
}
