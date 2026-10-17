import type { ComponentProps } from 'react';
import { Text as NativeText } from 'react-native';
import { Text } from '@/components/ui/text';

type BrandWordmarkProps = Omit<ComponentProps<typeof Text>, 'children'>;

/** The shared wordmark follows the light/dark primary color on every platform. */
export function BrandWordmark(props: BrandWordmarkProps) {
  return <Text accessibilityLabel="Triton42" {...props}>Triton<NativeText className="text-primary">42</NativeText></Text>;
}
