import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/** iOS full-window portals must reserve keyboard space; Android already resizes its window. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(() => Platform.OS === 'ios' ? Keyboard.metrics()?.height ?? 0 : 0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    function show(event: KeyboardEvent) { setInset(event.endCoordinates.height); }
    function hide() { setInset(0); }
    const shown = Keyboard.addListener('keyboardWillShow', show);
    const hidden = Keyboard.addListener('keyboardWillHide', hide);
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  return inset;
}
