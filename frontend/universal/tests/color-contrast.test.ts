import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, readableColor, colorHsv, hsvColor } from '../src/domain/color-contrast';
import { EVENT_PALETTE } from '../src/domain/event-colors';

test('all palette and extreme colors remain readable on both calendar themes', () => {
  for (const color of [...EVENT_PALETTE, '#ffffff', '#000000', '#ffff00', '#0000ff']) {
    for (const dark of [false, true]) {
      const displayed = readableColor(color, dark)!;
      for (const base of dark ? ['#111827', '#2c343f', '#374151'] : ['#ffffff', '#e5e7eb']) assert.ok(contrastRatio(displayed, base) >= 4.5, `${color} → ${displayed} on ${base}`);
    }
  }
});
test('yellow gets darker in light mode and stored input remains intact', () => {
  const color = '#facc15';
  assert.notEqual(readableColor(color, false), color);
  assert.equal(readableColor(color, true), color);
  assert.equal(color, '#facc15');
  assert.equal(readableColor(undefined, false), undefined);
  assert.equal(readableColor('invalid', true), undefined);
});
test('gradient picker round trips presets and white/black', () => {
  for (const color of [...EVENT_PALETTE, '#ffffff', '#000000']) {
    const hsv = colorHsv(color);
    assert.equal(hsvColor(hsv.hue, hsv.saturation, hsv.value), color);
  }
});
test('urgency text stays readable over a different series tint', () => {
  for (const dark of [false, true]) for (const series of EVENT_PALETTE) for (const urgency of EVENT_PALETTE) {
    const tint = readableColor(series, dark)!;
    const displayed = readableColor(urgency, dark, tint)!;
    const base = dark ? '#374151' : '#e5e7eb';
    const background = '#' + [1, 3, 5].map(index => Math.round(parseInt(tint.slice(index, index + 2), 16) * 0.15 + parseInt(base.slice(index, index + 2), 16) * 0.85).toString(16).padStart(2, '0')).join('');
    assert.ok(contrastRatio(displayed, background) >= 4.5);
  }
});
