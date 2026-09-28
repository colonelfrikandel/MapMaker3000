import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTownBase } from './town-generator.js';
import { validateTownBase, townBaseSvg } from './town-base.js';

test('town generation is original, repeatable, and renders without imported data', () => {
  const first = generateTownBase('town', 'Brightrock', 'standard');
  assert.equal(first.source, 'mapmaker-generated');
  assert.deepEqual(first, generateTownBase('town', 'Brightrock', 'standard'));
  assert.notDeepEqual(first.layers.buildings, generateTownBase('town', 'Another seed', 'standard').layers.buildings);
  assert.ok(first.layers.buildings.length > 150);
  assert.ok(first.layers.roads.length >= 10);
  assert.ok(first.layers.districts.length >= 4);
  assert.equal(validateTownBase(first), first);
  assert.match(townBaseSvg(first), /<svg/);
});

test('village sizes change density and keep shapes within the board', () => {
  const small = generateTownBase('village', 'Oakrest', 'small');
  const large = generateTownBase('village', 'Oakrest', 'large');
  assert.ok(large.layers.buildings.length > small.layers.buildings.length);
  for (const shape of large.layers.buildings) for (const [x,y] of shape) {
    assert.ok(x >= 0 && x <= 1010);
    assert.ok(y >= 0 && y <= 630);
  }
  assert.equal(validateTownBase(large), large);
});
