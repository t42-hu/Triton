import { DarkTheme, DefaultTheme } from 'expo-router';
const light = { primary: '#00288C', background: '#F3F7FD', card: '#FFFFFF', text: '#102348', border: '#C5D5EA', notification: '#00288C' };
const dark = { primary: '#8DB6FF', background: '#000000', card: '#071936', text: '#EFF5FF', border: '#35567A', notification: '#00DCDC' };
export const NAV_THEME = { light: { ...DefaultTheme, colors: light }, dark: { ...DarkTheme, colors: dark } };
