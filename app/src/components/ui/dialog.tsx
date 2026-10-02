import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { cn } from '@/lib/utils';
import { usePanelViewport } from '@/features/panel-viewport';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Text, View, type ViewProps } from 'react-native';
import { FadeIn, FadeOut, FadeInRight, FadeOutLeft, ReduceMotion } from 'react-native-reanimated';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/** The root portal stays below native document pickers and the system keyboard. */
function DialogOverlay({
  className,
  children,
  onPress, transitionKey,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode; transitionKey?: string;
}) {
  return (
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',
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
            entering={FadeInRight.duration(180).withInitialValues({ translateX: 16 }).reduceMotion(ReduceMotion.System)}
            exiting={FadeOutLeft.duration(100).reduceMotion(ReduceMotion.System)}>
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
  );
}
type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & { portalHost?: string; hidden?: boolean; transitionKey?: string };
function DialogContent({
  className, portalHost, transitionKey,
  children, forceMount, hidden = false,
  ...props
}: DialogContentProps) {
  const viewport = usePanelViewport();
  return (
    <DialogPortal hostName={portalHost} forceMount={forceMount}>
      <View pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} style={{ position: 'absolute', top: viewport.top, right: 0, bottom: viewport.bottom, left: 0, opacity: hidden ? 0 : 1 }}>
        <DialogOverlay forceMount={forceMount} transitionKey={transitionKey} style={Platform.OS === 'web' ? { top: viewport.top, bottom: viewport.bottom } : undefined}>
          <DialogPrimitive.Content
            forceMount={forceMount}
            className={cn(
              'web:animate-in web:fade-in-0 web:slide-in-from-right-4 web:duration-150 bg-card border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-2xl border p-6 shadow-lg shadow-black/5 sm:max-w-lg',
              className
            )}
            {...props}
            style={[{ maxHeight: viewport.height }, props.style]}>
            <>{children}</>
            <DialogPrimitive.Close
              className={cn(
                'absolute right-4 top-4 rounded-lg p-1 opacity-70 hover:bg-accent/60 active:bg-accent active:opacity-100',
                Platform.select({
                  web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
                })
              )}
              hitSlop={12}>
              <Icon
                as={X}
                className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}
              />
              <Text className="sr-only">Bezárás</Text>
            </DialogPrimitive.Close>
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
