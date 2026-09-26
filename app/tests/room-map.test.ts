import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { createHash } from 'node:crypto';
import { roomMapHtml } from '../src/features/room-map-html';
import { findRoomLocation } from '../src/features/room-location';
import { FLOOR_SHAPES, PLACES } from '../src/features/nik-map-data';

test('both map templates receive the complete canonical geometry and parse', () => {
  for (const mode of ['2d', '3d'] as const) {
    const html = roomMapHtml(mode, 'F');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));
    const places = html.match(/const PLACES = ([^\n]+);/)?.[1];
    const shapes = html.match(/const FLOOR_SHAPES = ([^\n]+);/)?.[1];
    assert.ok(places);
    assert.ok(shapes);
    assert.deepEqual(JSON.parse(places), PLACES);
    assert.deepEqual(JSON.parse(shapes), FLOOR_SHAPES);
  }
});

test('the 3D renderer reads every authored footprint into valid map coordinates', () => {
  const script = roomMapHtml('3d', 'F').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const validation = `
    const roomPaths = PLACES.map(place => place.path);
    const floorPaths = Object.values(FLOOR_SHAPES).flatMap(shape => [shape.shell, shape.corridor, shape.insets]);
    const footprints = [...roomPaths, ...floorPaths].filter(Boolean).flatMap(outlines);
    footprints.every(points => points.length >= 3) &&
      footprints.flat(2).every(value => Number.isFinite(value) && value >= 0 && value <= 1500);
  `;
  const context = { document: { querySelector: () => null } };
  assert.equal(new Script(script + validation).runInNewContext(context, { timeout: 1000 }), true);
});

test('both app maps use the updated F.08, entrance stairs, and F.09 layout', () => {
  const approvedGround = JSON.stringify(PLACES.filter(place => place.floor === 'F'));
  assert.equal(createHash('sha256').update(approvedGround).digest('hex'), '347e52cd94d549529e69044480446ed435cbbc12a7b8a6630044bb1d8af53a72');
  for (const mode of ['2d', '3d'] as const) {
    const html = roomMapHtml(mode, 'F', 'f-09');
    assert.ok(html.includes('M274 735H422V849H274Z'));
    assert.ok(html.includes('M427 731H466V855H427Z'));
    assert.ok(html.includes('M536 735H684V849H536Z'));
    assert.ok(html.includes('M267 703H684V735H267Z'));
    assert.ok(html.includes('H684V860H536V735H466V860H274'));
    assert.ok(!html.includes('H743V860H274'));
    assert.ok(html.includes('map.selectPlace("f-09")'));
    assert.ok(html.includes("window.parent.postMessage({ type: 'triton-floor-change', floor }, '*')"));
    assert.ok(!roomMapHtml(mode, '2', 'f-09').includes('map.selectPlace('));
  }
  assert.equal(findRoomLocation('F.09')?.place?.x, 610);
});

function placeById(id: string) {
  const place = PLACES.find(item => item.id === id);
  assert.ok(place, `Missing map place: ${id}`);
  return place;
}

test('photographed vertical circulation remains aligned with the approved ground floor', () => {
  const groundLift = placeById('f-lift');
  const groundStairs = placeById('f-entry-stairs');
  for (const floor of ['1', '2', '3', '4']) {
    const lift = placeById(`${floor}-lift`);
    assert.deepEqual([lift.x, lift.y], [groundLift.x, groundLift.y]);
  }
  for (const id of ['a-stairs', '1-front-stairs', '2-front-stairs']) {
    const stairs = placeById(id);
    assert.deepEqual([stairs.x, stairs.y], [groundStairs.x, groundStairs.y]);
  }
});

test('the offices named on the sign belong to their photographed wings', () => {
  const auditorium = placeById('1-auditorium');
  assert.ok(placeById('1-meeting').y > auditorium.y);
  assert.ok(placeById('1-emeritus').x > placeById('1-meeting').x);
  assert.equal(placeById('1-meeting').tone, 'research');
  assert.equal(placeById('1-emeritus').tone, 'research');
  assert.ok(placeById('2-ekik-office').y > placeById('2-rector').y);
  assert.equal(placeById('2-ekik-office').tone, 'research');
  assert.equal(findRoomLocation('4.01')?.place?.id, '4-meeting');
  assert.ok(placeById('4-meeting').x < placeById('4-dean').x);
});
