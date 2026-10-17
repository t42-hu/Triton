import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Icon } from './icon';
import { Input } from './input';

type PasswordInputProps = React.ComponentProps<typeof Input>;

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return <View className="relative">
    <Input {...props} className={className ? `${className} pr-12` : 'pr-12'} secureTextEntry={!visible} />
    <Pressable accessibilityRole="button" className="absolute right-0 top-0 h-full w-12 items-center justify-center rounded-lg" accessibilityLabel={visible ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'} accessibilityState={{ expanded: visible }} onPress={() => setVisible(value => !value)}>
      <Icon as={visible ? EyeOff : Eye} size={18} className="text-muted-foreground" />
    </Pressable>
  </View>;
}

export { PasswordInput };
