/** Adjusts only the displayed color; stored user colors remain untouched. */
export function readableColor(color: string | undefined, dark: boolean, backgroundTint?: string): string | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const bases = dark ? ['#111827', '#2c343f', '#374151'] : ['#ffffff', '#e5e7eb'];
  const rgb = channels(color);
  const target = dark ? 255 : 0;
  for (let step = 0; step <= 100; step++) {
    const candidate = hex(rgb.map(channel => Math.round(channel + (target - channel) * step / 100)));
    if (bases.every(base => contrastRatio(candidate, base) >= 4.5 && contrastRatio(candidate, blend(backgroundTint ?? candidate, base, 0.15)) >= 4.5)) return candidate;
  }
  return dark ? '#ffffff' : '#000000';
}
function channels(color: string): number[] { return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)); }
function hex(rgb: number[]): string { return '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join(''); }
function blend(color: string, base: string, alpha: number): string {
  const background = channels(base);
  return hex(channels(color).map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha))));
}
export function contrastRatio(a: string, b: string): number {
  function luminance(color: string) {
    const rgb = channels(color).map(channel => { const s = channel / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export function hsvColor(hue: number, saturation: number, value: number): string {
  const sector = hue / 60; const chroma = value * saturation; const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const rgb = sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0] : sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] : sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return hex(rgb.map(channel => Math.round((channel + value - chroma) * 255)));
}
export function colorHsv(color: string): { hue: number; saturation: number; value: number } {
  const [r, g, b] = channels(color).map(channel => channel / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = !delta ? 0 : max === r ? 60 * ((g - b) / delta % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  return { hue: (hue + 360) % 360, saturation: max ? delta / max : 0, value: max };
}
