import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openProfile } from '../src/features/view-state';
import type { ViewState } from '../src/features/app-state';

const view: ViewState = {
  left: 1, right: 2, openProfiles: [2], leftDate: '2026-09-28', rightDate: '2026-09-21',
  mode: 'week', compare: true, arrangement: 'column', sync: false, common: true, hidden: false,
  zoom: 1, leftScroll: 420, rightScroll: 420, theme: 'system',
};

test('opening a profile keeps common hours on the same period', () => {
  assert.deepEqual(openProfile(view, 3), {
    openProfiles: [2, 3], right: 3, compare: true, rightDate: view.leftDate,
  });
  assert.deepEqual(openProfile({ ...view, common: false }, 3), {
    openProfiles: [2, 3], right: 3, compare: true,
  });
  assert.deepEqual(openProfile(view, 2), {});
});
