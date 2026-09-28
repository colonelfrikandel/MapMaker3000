import test from 'node:test';
import assert from 'node:assert/strict';
import { worldLandShape, worldSvg } from './world-generator.js';

const realms = [
  { name:'Kemeia', x:240, y:315, radius:150, biome:'forest' },
  { name:'Idrieland', x:500, y:245, radius:150, biome:'snow' },
  { name:'Emerald Bay', x:745, y:350, radius:150, biome:'plains' },
  { name:'Crieta', x:825, y:89, radius:65, biome:'forest', island:true },
];

test('neighboring mainland realms share one rounded coastline and islands remain separate', () => {
  const shape = worldLandShape(realms, 'test seed');
  assert.equal(shape.land.length, 160);
  assert.equal(shape.islands.length, 1);
  for (const [x,y] of [...shape.land,...shape.islands.flat()]) {
    assert.ok(x>0 && x<1010);
    assert.ok(y>0 && y<630);
  }
  assert.equal(worldLandShape(realms.map(r=>({ ...r, island:false })), 'test seed').islands.length, 0);
});

test('world seed changes coast and details while biomes blend through gradients', () => {
  assert.deepEqual(worldLandShape(realms,'same'),worldLandShape(realms,'same'));
  assert.notDeepEqual(worldLandShape(realms,'same').land,worldLandShape(realms,'other').land);
  const svg=worldSvg(realms,'same');
  assert.match(svg,/world-main-clip/);
  assert.match(svg,/world-islands-clip/);
  assert.match(svg,/#dbe0d5/);
  assert.match(svg,/#a9b685/);
  assert.ok(svg.length<100000);
});
