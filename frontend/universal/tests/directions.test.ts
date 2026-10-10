import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionsDestination, directionsUrl, NIK_DESTINATION } from '../src/domain/directions';

test('mapped campus rooms navigate to NIK; other addresses remain their own destination', () => {
  assert.equal(directionsDestination('BA.1.01'), NIK_DESTINATION);
  assert.equal(directionsDestination(' Budapest, Deák Ferenc tér '), 'Budapest, Deák Ferenc tér');
  assert.equal(directionsDestination('BB.1.01'), 'BB.1.01');
});
test('empty, online and executable locations never become physical destinations', () => {
  for (const location of ['', 'https://meet.google.com/a', 'Online', 'Teams meeting', 'javascript:alert(1)', 'a'.repeat(501)]) assert.equal(directionsDestination(location), null);
});
test('directions encode the destination and delegate current location to the selected map', () => {
  const url = new URL(directionsUrl('Budapest, Bécsi út 96/B & café', 'google', 'transit'));
  assert.equal(url.searchParams.get('destination'), 'Budapest, Bécsi út 96/B & café');
  assert.equal(url.searchParams.get('origin'), null);
  assert.equal(url.searchParams.get('dir_action'), 'navigate');
  assert.equal(url.searchParams.get('travelmode'), 'transit');
  const apple = new URL(directionsUrl(NIK_DESTINATION, 'apple', 'walking'));
  assert.equal(apple.searchParams.get('daddr'), NIK_DESTINATION);
  assert.equal(apple.searchParams.get('dirflg'), 'w');
  assert.equal(new URL(directionsUrl(NIK_DESTINATION, 'waze', 'driving')).searchParams.get('navigate'), 'yes');
});
test('map share links stay intact while unrelated links cannot become directions', () => {
  const location = 'https://maps.apple/p/A3Aax7Q3fsqRYp';
  assert.equal(directionsDestination(location), location);
  assert.equal(directionsUrl(location, 'google', 'transit'), location);
  for (const link of ['https://maps.app.goo.gl/example', 'https://www.google.com/maps/place/Budapest']) assert.equal(directionsDestination(link), link);
  for (const link of ['https://maps.apple.evil.test/p/example', 'https://example.com', 'https://user:password@maps.apple/p/example']) assert.equal(directionsDestination(link), null);
});
