import { DarkTheme, DefaultTheme } from 'expo-router';
const light = { primary: '#00288C', background: '#F6F7F9', card: '#FFFFFF', text: '#1E2732', border: '#D2D8E0', notification: '#00288C' };
const dark = { primary: '#9EB7ED', background: '#111317', card: '#1B1E23', text: '#F0F2F5', border: '#3C434C', notification: '#00DCDC' };
export const NAV_THEME = { light: { ...DefaultTheme, colors: light }, dark: { ...DarkTheme, colors: dark } };
