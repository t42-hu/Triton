import { DarkTheme, DefaultTheme } from 'expo-router';
const light = { primary: '#122347', background: '#F4F6FA', card: '#FFFFFF', text: '#182238', border: '#DCE3EF', notification: '#122347' };
const dark = { primary: '#A9C3F5', background: '#101827', card: '#192438', text: '#EDF2FA', border: '#334158', notification: '#A9C3F5' };
export const NAV_THEME = { light: { ...DefaultTheme, colors: light }, dark: { ...DarkTheme, colors: dark } };
