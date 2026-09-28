import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, levelAtScale, blend, intersects, nearbyPlaces, ZOOM_STEP } from './geometry.js';

test('neighboring continents keep their province maps at one shared detail level', () => {
  const atlas = {
    rootBoardId: 'world',
    boards: {
      world: { id: 'world', placeIds: ['a', 'b'] },
      aMap: { id: 'aMap', placeIds: ['aProvince'] },
      bMap: { id: 'bMap', placeIds: ['bProvince'] },
    },
    places: {
      a: { id: 'a', boardId: 'world', type: 'continent', x: 50, y: 50, childBoardId: 'aMap' },
      b: { id: 'b', boardId: 'world', type: 'continent', x: 400, y: 50, childBoardId: 'bMap' },
      aProvince: { id: 'aProvince', boardId: 'aMap', type: 'province', x: 200, y: 200 },
      bProvince: { id: 'bProvince', boardId: 'bMap', type: 'province', x: 200, y: 200 },
    },
  };
  const layout = buildLayout(atlas);
  assert.equal(layout.places.get('aProvince').depth, 1);
  assert.equal(layout.places.get('bProvince').depth, 1);
  assert.equal(layout.places.get('bProvince').x - layout.places.get('aProvince').x, 350);
  const a = layout.places.get('aProvince'), b = layout.places.get('bProvince');
  assert.equal(intersects(a, { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height }), true);
  assert.equal(intersects(b, { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height }), false);
  assert.deepEqual(nearbyPlaces(layout, 1, { left: a.x, top: a.y, right: a.x + a.width, bottom: a.y + a.height }), ['aProvince']);
});

test('zoom depth and blending reverse continuously', () => {
  const base = 0.7;
  assert.equal(levelAtScale(base, base), 0);
  assert.equal(levelAtScale(base * ZOOM_STEP, base), 1);
  assert.equal(levelAtScale(base * Math.sqrt(ZOOM_STEP), base), 0.5);
  assert.equal(blend(0), 0);
  assert.equal(blend(1), 1);
});
