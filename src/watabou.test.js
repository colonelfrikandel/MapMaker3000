import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWatabouTown, townBaseSvg, validateTownBase, nearestTownFootprint } from './town-base.js';

const sample = {
  type: 'FeatureCollection', features: [
    { type: 'Feature', id: 'values', generator: 'mfcg', version: '0.11.5' },
    { type: 'MultiPolygon', id: 'buildings', coordinates: [[[[0,0],[20,0],[20,20],[0,20]]]] },
    { type: 'GeometryCollection', id: 'districts', geometries: [
      { type: 'Polygon', name: '<Market & Square>', coordinates: [[[0,0],[30,0],[30,30],[0,30]]] },
    ] },
    { type: 'MultiPolygon', id: 'water', coordinates: [[[[30,0],[50,0],[50,30],[30,30]]]] },
    { type: 'GeometryCollection', id: 'rivers', geometries: [{ type: 'LineString', width: 3, coordinates: [[0,0],[30,30]] }] },
  ],
};

test('Watabou town geometry becomes a compact local map with safe district labels', () => {
  const base = normalizeWatabouTown(sample);
  assert.equal(base.layers.buildings.length, 1);
  assert.equal(base.layers.districts[0].name, '<Market & Square>');
  assert.ok(base.layers.water[0][0][0] > base.layers.buildings[0][0][0]);
  const svg = townBaseSvg(base);
  assert.match(svg, /&lt;Market &amp; Square&gt;/);
  assert.doesNotMatch(svg, /<Market & Square>/);
  assert.doesNotMatch(JSON.stringify(base), /"coordinates"/);
  const building = base.layers.buildings[0];
  const center = { x: building.reduce((sum,p)=>sum+p[0],0)/building.length, y: building.reduce((sum,p)=>sum+p[1],0)/building.length };
  assert.equal(nearestTownFootprint(base, center).index, 0);
  assert.equal(nearestTownFootprint(base, { x: -100, y: -100 }), null);
});

test('invalid imported geometry is rejected before rendering', () => {
  const base = normalizeWatabouTown(sample);
  base.layers.buildings[0][0][0] = Infinity;
  assert.throws(() => validateTownBase(base), /coordinate/);
});
