import { PanelScrollContext, usePanelScrollController } from './panel-scroll';
import { useRef, type ReactNode } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function Action({ children, onPress, disabled = false, secondary = false, label, icon = ChevronRight, quiet = false, expanded }: { children: string; onPress: () => void; disabled?: boolean; secondary?: boolean; label?: string; icon?: LucideIcon; quiet?: boolean; expanded?: boolean }) {
  return <Button accessibilityLabel={label ?? children} accessibilityState={expanded === undefined ? undefined : { expanded }} disabled={disabled} variant={quiet ? 'ghost' : secondary ? 'outline' : 'default'} onPress={onPress}>{icon ? <Icon as={icon} size={17} className={secondary || quiet ? 'text-foreground' : 'text-primary-foreground'} /> : null}<Text>{children}</Text></Button>;
}
export function Field({ label, value, onChange, placeholder, insetLabel = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; insetLabel?: boolean }) {
  return <View className="relative gap-1.5">{insetLabel ? <View pointerEvents="none" className="absolute left-3 top-2 z-10"><Label nativeID={label} className="text-xs text-muted-foreground">{label}</Label></View> : <Label nativeID={label}>{label}</Label>}<Input className={insetLabel ? 'h-14 pb-2 pt-6 sm:h-14' : undefined} accessibilityLabel={label} aria-labelledby={label} value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="none" /></View>;
}
export function Choice({ label, value, options, onChange, fullWidth = false, icon }: { icon?: LucideIcon; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; fullWidth?: boolean }) {
  return <Select value={options.find(option => option.value === value)} onValueChange={option => { if (option) onChange(option.value); }}>
    <SelectTrigger accessibilityLabel={label} className={fullWidth ? 'w-full' : 'min-w-36'}>{icon ? <Icon as={icon} size={17} className="shrink-0 text-primary" /> : null}<SelectValue className="min-w-0 flex-1 text-left" placeholder={label} /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} {...option} />)}</SelectContent>
  </Select>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <View className="flex-row items-center gap-2"><Switch accessibilityLabel={label} checked={checked} onCheckedChange={onChange} /><Text className="min-w-0 flex-1 text-sm">{label}</Text></View>;
}
export function Modal({ title, description, close, children, footer, wide = false, maxWidth, scrollGesture, open = true, keepMounted = false, dismissible = true }: { dismissible?: boolean; title: string; description?: string; close: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; maxWidth?: number; scrollGesture?: ReturnType<typeof Gesture.Native>; open?: boolean; keepMounted?: boolean }) {
  const { width } = useWindowDimensions();
  const viewport = usePanelViewport();
  const keyboardInset = useKeyboardInset();
  const { scroll, requestRevealEnd, revealExpandedContent } = usePanelScrollController();
  const { revealFocusedInput, rememberOffset } = useFocusedInputVisibility(open, keyboardInset, scroll);
  const availableHeight = viewport.height;
  const panelWidth = maxWidth ?? (wide ? 960 : 576);
  const content = <ScrollView ref={scroll} onContentSizeChange={revealExpandedContent} onFocus={revealFocusedInput} onLayout={revealFocusedInput} onScroll={rememberOffset} scrollEventThrottle={16} nestedScrollEnabled directionalLockEnabled keyboardDismissMode="none" style={{ marginRight: -16, maxHeight: Math.max(0, availableHeight - (description ? 144 : 104) - (footer ? 72 : 0)), ...(Platform.OS === 'web' ? { overscrollBehavior: 'contain' as const } : {}) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20, paddingRight: 16, paddingBottom: 12 }}><PanelScrollContext.Provider value={requestRevealEnd}>{children}</PanelScrollContext.Provider></ScrollView>;
  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen && dismissible) close(); }}><DialogContent dismissible={dismissible} forceMount={keepMounted ? true : undefined} hidden={!open} transitionKey={title} className={wide ? 'sm:max-w-[960px]' : undefined} style={{ width: Math.min(width - 32, panelWidth), maxWidth: panelWidth, maxHeight: availableHeight }}>
    <DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}
    {scrollGesture ? <GestureDetector gesture={scrollGesture}>{content}</GestureDetector> : content}
    {footer ? <View className="border-t border-border pt-3">{footer}</View> : null}
  </DialogContent></Dialog>;
}
export function Confirm({ title, description, accept, cancel }: { title: string; description: string; accept: () => void; cancel: () => void }) {
  return <AlertDialog open onOpenChange={open => { if (!open) cancel(); }}><AlertDialogContent>
    <AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription>
    <AlertDialogFooter><AlertDialogCancel><Icon as={X} size={17} /><Text>Mégse</Text></AlertDialogCancel><Action icon={Check} onPress={accept}>Jóváhagyás</Action></AlertDialogFooter>
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
