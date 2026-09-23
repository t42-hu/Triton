const palette = require('../tailwind.palette');
const roles = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring'];
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: { ...palette.theme.extend.colors, ...Object.fromEntries(roles.map(role => [role, `hsl(var(--${role}) / <alpha-value>)`])) } } },
  plugins: [require('tailwindcss-animate')],
};
