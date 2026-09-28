import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkForPlace, artworkForBoard } from './cartography.js';

test('map artwork repeats for a saved place and does not embed its name as SVG markup', () => {
  const place = { type: 'town', name: '<script>unsafe</script>', provenance: { seed: 'harbor' } };
  const first = artworkForPlace(place);
  assert.equal(first, artworkForPlace(place));
  assert.match(first, /<svg/);
  assert.match(first, /<rect/);
  assert.doesNotMatch(first, /<script>/);
});

test('a house floor connects its room footprints', () => {
  const board = { kind: 'house', name: 'The Lantern', placeIds: ['a', 'b'] };
  const atlas = { places: { a: { type: 'room', x: 200, y: 150 }, b: { type: 'room', x: 560, y: 320 } } };
  const art = artworkForBoard(board, atlas);
  assert.match(art, /M290 217H650V387/);
});
