import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const [focused, setFocused] = useState(false);
  // Draw the frame independently of UIKit's text field and web focus outlines.
  if (Platform.OS === 'ios') {
    return <View className={cn(
      'border-input bg-card flex h-11 w-full min-w-0 flex-row items-center rounded-lg border px-3 py-2',
      props.editable === false && 'opacity-50',
      className,
      focused && 'border-primary'
    )} style={{ overflow: 'hidden', borderCurve: 'circular', outlineWidth: 0, boxShadow: [] }}>
      <TextInput
        {...props}
        className="h-full min-w-0 flex-1 bg-transparent p-0 text-base leading-5 text-foreground placeholder:text-muted-foreground"
        style={[props.style, { borderWidth: 0, borderRadius: 0 }]}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }}
        onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      />
    </View>;
  }
  return (
    <TextInput
      className={cn(
        'border-input bg-card text-foreground flex h-11 w-full min-w-0 flex-row items-center rounded-lg border hover:border-primary/50 focus:border-primary px-3 py-2 text-base leading-5',
        props.editable === false && 'opacity-50',
        Platform.select({
          web: cn(
            'disabled:pointer-events-none disabled:cursor-not-allowed',
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground',
          android: 'h-12',
        }),
        className
      )}
      {...props}
    />
  );
}

export { Input };
