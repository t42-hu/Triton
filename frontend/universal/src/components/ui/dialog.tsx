import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { cn } from '@/lib/utils';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { usePanelViewport } from '@/features/panel-viewport';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Text, View, type ViewProps } from 'react-native';
import { FadeIn, FadeOut, FadeInDown, FadeInRight, FadeInLeft, FadeOutLeft, ReduceMotion } from 'react-native-reanimated';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/** The root portal stays below native document pickers and the system keyboard. */
function DialogOverlay({
  className,
  children,
  onPress, transitionKey, backwards = false, pickerMotion = false,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode; transitionKey?: string; backwards?: boolean; pickerMotion?: boolean;
}) {
  return (
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',
          Platform.select({
            web: 'animate-in fade-in-0 motion-reduce:animate-none fixed cursor-default [&>*]:cursor-auto',
          }),
          className
        )}
        {...props}
        onPress={onPress}
        asChild={Platform.OS !== 'web'}>
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          as="Pressable">
          <NativeOnlyAnimatedView
            key={transitionKey}
            collapsable={false}
            entering={pickerMotion ? FadeInDown.duration(180).withInitialValues({ transform: [{ translateY: 8 }] }).reduceMotion(ReduceMotion.System) : (backwards ? FadeInLeft : FadeInRight).duration(240).withInitialValues({ transform: [{ translateX: backwards ? -24 : 24 }] }).reduceMotion(ReduceMotion.System)}
            exiting={FadeOutLeft.duration(100).reduceMotion(ReduceMotion.System)}>
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
  );
}
type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & { backwards?: boolean; fullViewport?: boolean; portalHost?: string; hidden?: boolean; transitionKey?: string; dismissible?: boolean; onClose?: () => void; overlayClassName?: string; pickerMotion?: boolean };
function DialogContent({
  className, portalHost, transitionKey, overlayClassName, backwards = false, pickerMotion = false, fullViewport = false,
  children, forceMount, hidden = false, dismissible = true, onClose,
  ...props
}: DialogContentProps) {
  const viewport = usePanelViewport(); const keyboardInset = useKeyboardInset();
  return (
    <DialogPortal hostName={portalHost} forceMount={forceMount}>
      <View pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} style={{ position: Platform.OS === 'web' ? 'fixed' as 'absolute' : 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: hidden ? 0 : 1, ...(Platform.OS === 'web' ? { zIndex: 1000 } : {}) }}>
        <DialogOverlay backwards={backwards} pickerMotion={pickerMotion} className={overlayClassName} forceMount={forceMount} transitionKey={`${transitionKey}:${hidden}`} closeOnPress={false} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: fullViewport ? 8 : viewport.top + 8, paddingBottom: fullViewport ? keyboardInset + 8 : viewport.bottom + 8 }}>
          <DialogPrimitive.Content
            forceMount={forceMount}
            className={cn(
              'bg-card border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-xl border-border border p-5 shadow-lg shadow-primary/5 sm:max-w-lg',
              pickerMotion ? 'web:animate-in web:fade-in-0 web:zoom-in-95 web:slide-in-from-bottom-2 web:duration-200 web:ease-out web:motion-reduce:animate-none' : backwards ? 'web:animate-in web:fade-in-0 web:slide-in-from-left-6 web:duration-200 web:ease-out web:motion-reduce:animate-none' : 'web:animate-in web:fade-in-0 web:slide-in-from-right-6 web:duration-200 web:ease-out web:motion-reduce:animate-none',
              className
            )}
            {...props}
            style={[{ maxHeight: viewport.height }, props.style]}>
            <>{children}</>
            {dismissible ? <DialogPrimitive.Close onPress={onClose}
              className={cn(
                'absolute right-2 top-2 h-11 w-11 items-center justify-center rounded-lg p-2 opacity-70 hover:bg-accent/60 active:bg-accent active:opacity-100',
                Platform.select({
                  android: 'h-12 w-12', web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
                })
              )}
              hitSlop={12}>
              <Icon
                as={X}
                className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}
              />
              <Text className="sr-only">Bezárás</Text>
            </DialogPrimitive.Close> : null}
          </DialogPrimitive.Content>
        </DialogOverlay>
      </View>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-foreground text-lg font-semibold leading-snug pr-6', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
