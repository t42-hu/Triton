import { DarkTheme, DefaultTheme } from 'expo-router';
const light = { primary: '#415A77', background: '#E0E1DD', card: '#FFFFFF', text: '#0D1B2A', border: '#778DA9', notification: '#415A77' };
const dark = { primary: '#778DA9', background: '#0D1B2A', card: '#1B263B', text: '#E0E1DD', border: '#415A77', notification: '#778DA9' };
export const NAV_THEME = { light: { ...DefaultTheme, colors: light }, dark: { ...DarkTheme, colors: dark } };
