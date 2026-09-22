import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function Action({ children, onPress, disabled = false, secondary = false, label, icon, quiet = false }: { children: string; onPress: () => void; disabled?: boolean; secondary?: boolean; label?: string; icon?: LucideIcon; quiet?: boolean }) {
  return <Button accessibilityLabel={label ?? children} disabled={disabled} variant={quiet ? 'ghost' : secondary ? 'outline' : 'default'} onPress={onPress}>{icon ? <Icon as={icon} size={17} className={secondary || quiet ? 'text-foreground' : 'text-primary-foreground'} /> : null}<Text>{children}</Text></Button>;
}
export function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View className="gap-1.5"><Label nativeID={label}>{label}</Label><Input accessibilityLabel={label} aria-labelledby={label} value={value} onChangeText={onChange} placeholder={placeholder} autoCapitalize="none" /></View>;
}
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select value={options.find(option => option.value === value)} onValueChange={option => { if (option) onChange(option.value); }}>
    <SelectTrigger accessibilityLabel={label} className="min-w-36"><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} {...option} />)}</SelectContent>
  </Select>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <View className="flex-row items-center gap-2"><Switch accessibilityLabel={label} checked={checked} onCheckedChange={onChange} /><Text className="text-sm">{label}</Text></View>;
}
export function Modal({ title, description, close, children }: { title: string; description: string; close: () => void; children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const availableHeight = height - useKeyboardInset();
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent style={{ width: Math.min(width - 32, 576), maxWidth: 576, maxHeight: availableHeight - 32 }}>
    <DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>
    <ScrollView style={{ maxHeight: Math.max(80, availableHeight - 230) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>{children}</ScrollView>
  </DialogContent></Dialog>;
}
export function Confirm({ title, description, accept, cancel }: { title: string; description: string; accept: () => void; cancel: () => void }) {
  return <AlertDialog open onOpenChange={open => { if (!open) cancel(); }}><AlertDialogContent>
    <AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription>
    <AlertDialogFooter><AlertDialogCancel><Text>Mégse</Text></AlertDialogCancel><Action onPress={accept}>Jóváhagyás</Action></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
