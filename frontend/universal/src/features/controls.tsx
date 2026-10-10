import { SetupStep } from './setup-shell';
import { useRegisterPanel } from './panel-lock';
import { PanelScrollContext, usePanelScrollController } from './panel-scroll';
import { useEffect, useRef, type ReactNode } from 'react';
import { Check, ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Keyboard, Platform, ScrollView, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { usePanelViewport } from './panel-viewport';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useMotionValue } from '@/hooks/use-motion-value';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function Action({ children, onPress, disabled = false, secondary = false, label, icon = ChevronRight, quiet = false, expanded, revealOnExpand = true }: { children: string; onPress: () => void; disabled?: boolean; secondary?: boolean; label?: string; icon?: LucideIcon; quiet?: boolean; expanded?: boolean; revealOnExpand?: boolean }) {
  const iconClass = secondary || quiet ? 'text-foreground' : 'text-primary-foreground';
  return <Button revealOnExpand={revealOnExpand} accessibilityLabel={label ?? children} accessibilityState={expanded === undefined ? undefined : { expanded }} disabled={disabled} variant={quiet ? 'ghost' : secondary ? 'outline' : 'default'} onPress={onPress}>{expanded !== undefined && icon === ChevronRight ? <DisclosureChevron expanded={expanded} className={iconClass} /> : icon ? <Icon as={icon} size={17} className={iconClass} /> : null}<Text>{children}</Text></Button>;
}

/** Keeps the disclosure indicator synchronized with the content transition. */
function DisclosureChevron({ expanded, className }: { expanded: boolean; className: string }) {
  const progress = useMotionValue(Number(expanded));
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 90}deg` }] }));
  return <Animated.View style={style}><Icon as={ChevronRight} size={17} className={className} /></Animated.View>;
}
export function Field({ label, value, onChange, placeholder, insetLabel = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; insetLabel?: boolean }) {
  return <View className="relative gap-2">{insetLabel ? <View pointerEvents="none" className="absolute left-3 top-2 z-10"><Label nativeID={label} className="text-xs text-muted-foreground">{label}</Label></View> : <Label nativeID={label}>{label}</Label>}<Input className={insetLabel ? 'h-14 pb-2 pt-6 sm:h-14' : undefined} accessibilityLabel={label} aria-labelledby={label} value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="none" /></View>;
}
export function Choice({ label, value, options, onChange, fullWidth = false, icon }: { icon?: LucideIcon; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; fullWidth?: boolean }) {
  return <Select value={options.find(option => option.value === value)} onValueChange={option => { if (option) onChange(option.value); }}>
    <SelectTrigger accessibilityLabel={label} className={fullWidth ? 'w-full' : 'min-w-36'}>{icon ? <Icon as={icon} size={17} className="shrink-0 text-primary" /> : null}<SelectValue className="min-w-0 flex-1 text-left" placeholder={label} /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} {...option} />)}</SelectContent>
  </Select>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <View className="min-h-12 flex-row items-center gap-3"><Switch accessibilityLabel={label} checked={checked} onCheckedChange={onChange} /><Text className="min-w-0 flex-1 text-sm">{label}</Text></View>;
}
export function Modal({ title, description, close, children, footer, header, navigation, fixedHeight, backwards = false, hideHeading = false, setup = false, pickerMotion = false, wide = false, maxWidth, scrollGesture, scrollToEndKey, scrollToStartKey, open = true, keepMounted = false, dismissible = true }: { backwards?: boolean; hideHeading?: boolean; dismissible?: boolean; title: string; description?: string; close: () => void; children: ReactNode; footer?: ReactNode; header?: ReactNode; navigation?: ReactNode; fixedHeight?: number; setup?: boolean; pickerMotion?: boolean; wide?: boolean; maxWidth?: number; scrollGesture?: ReturnType<typeof Gesture.Native>; scrollToEndKey?: unknown; scrollToStartKey?: unknown; open?: boolean; keepMounted?: boolean }) {
  useRegisterPanel(open);
  const { width, height } = useWindowDimensions();
  const viewport = usePanelViewport();
  const keyboardInset = useKeyboardInset();
  const { scroll, requestRevealEnd, revealExpandedContent } = usePanelScrollController();
  useEffect(() => { if (scrollToEndKey != null) { requestRevealEnd(); revealExpandedContent(); } }, [scrollToEndKey, requestRevealEnd, revealExpandedContent]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [title, scrollToStartKey, scroll]);
  const { revealFocusedInput, rememberOffset } = useFocusedInputVisibility(open, keyboardInset, scroll);
  const availableHeight = setup ? height - keyboardInset - 16 : viewport.height;
  const panelWidth = maxWidth ?? (wide ? 960 : 576);
  const content = <ScrollView className="panel-scroll" showsVerticalScrollIndicator persistentScrollbar={Platform.OS === 'android'} ref={scroll} onContentSizeChange={revealExpandedContent} onFocus={revealFocusedInput} onLayout={revealFocusedInput} onScroll={rememberOffset} scrollEventThrottle={16} nestedScrollEnabled directionalLockEnabled keyboardDismissMode="none" style={{ marginRight: 0, ...(setup || fixedHeight != null ? { flex: 1, minHeight: 0 } : { maxHeight: Math.max(0, availableHeight - (description ? 144 : 104) - (footer ? 72 : 0)) }), ...(Platform.OS === 'web' ? { overscrollBehavior: 'contain' as const } : {}) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 24, paddingLeft: Platform.OS === 'web' ? 0 : 8, paddingRight: 12, paddingBottom: 12 }}><PanelScrollContext.Provider value={requestRevealEnd}>{setup && !hideHeading ? <View className="gap-2"><Text accessibilityRole="header" className="text-2xl font-semibold tracking-tight">{title}</Text>{description ? <Text className="text-sm leading-6 text-muted-foreground">{description}</Text> : null}</View> : null}{setup ? navigation : null}{children}</PanelScrollContext.Provider></ScrollView>;
  if (setup) return <SetupStep title={title} header={header} footer={footer} open={open} backwards={backwards}>{content}</SetupStep>;
  return <Dialog open={open} onOpenChange={() => undefined}><DialogContent backwards={backwards} fullViewport={setup} pickerMotion={pickerMotion} onClose={close} dismissible={dismissible} forceMount={keepMounted ? true : undefined} hidden={!open} transitionKey={title} overlayClassName={setup ? 'bg-background' : undefined} className={setup ? 'gap-5 rounded-3xl border-border/60 p-6 shadow-xl shadow-primary/5 sm:p-8' : wide ? 'sm:max-w-[960px]' : undefined} style={{ width: Math.min(width - 32, panelWidth), maxWidth: panelWidth, maxHeight: availableHeight, ...(fixedHeight != null ? { height: Math.min(availableHeight, fixedHeight) } : {}) }}>
    {header}
    <>{hideHeading ? <DialogTitle style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>{title}</DialogTitle> : setup ? <View className="gap-2"><DialogTitle className="pr-0 text-2xl tracking-tight">{title}</DialogTitle>{description ? <DialogDescription className="leading-6">{description}</DialogDescription> : null}</View> : <><DialogTitle className="pr-10 text-xl font-semibold tracking-tight">{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</>}</>
    {navigation}
    {scrollGesture ? <GestureDetector gesture={scrollGesture}>{content}</GestureDetector> : content}
    {footer ? <View className="border-t border-border pt-4">{footer}</View> : null}
  </DialogContent></Dialog>;
}
export function Confirm({ title, description, accept, cancel, busy = false }: { title: string; description: string; accept: () => void; cancel: () => void; busy?: boolean }) {
  useRegisterPanel(true);
  return <AlertDialog open onOpenChange={() => undefined}><AlertDialogContent>
    <AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription>
    <AlertDialogFooter><AlertDialogCancel disabled={busy} onPress={cancel}><Icon as={X} size={17} /><Text>Mégse</Text></AlertDialogCancel><Action icon={Check} disabled={busy} onPress={accept}>{busy ? 'Folyamatban…' : 'Jóváhagyás'}</Action></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}

/** Resizing a form keeps its focused field visible without dismissing the keyboard during drags. */
function useFocusedInputVisibility(open: boolean, keyboardInset: number, scroll: React.RefObject<ScrollView | null>) {
  const offset = useRef(0); const frame = useRef({ top: 0, bottom: 0 });
  function rememberOffset(event: NativeSyntheticEvent<NativeScrollEvent>) { offset.current = event.nativeEvent.contentOffset.y; }
  function measureInput(_x: number, y: number, _width: number, height: number) {
    const overflow = y + height + 12 - frame.current.bottom;
    const above = y - frame.current.top - 12;
    if (overflow <= 0 && above >= 0) return;
    scroll.current?.scrollTo({ y: Math.max(0, offset.current + (overflow > 0 ? overflow : above)), animated: false });
  }
  function measureViewport(_x: number, y: number, _width: number, height: number) {
    frame.current = { top: y, bottom: y + height };
    TextInput.State.currentlyFocusedInput()?.measureInWindow(measureInput);
  }
  function measure() { scroll.current?.getNativeScrollRef()?.measureInWindow(measureViewport); }
  function revealFocusedInput() {
    if (!open || Platform.OS === 'web' || keyboardInset <= 0 && !Keyboard.isVisible()) return;
    requestAnimationFrame(measure);
  }
  return { rememberOffset, revealFocusedInput };
}
