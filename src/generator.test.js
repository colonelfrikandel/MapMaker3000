import test from 'node:test';
import assert from 'node:assert/strict';
import { planDetails } from './generator.js';
import { cardSize } from './geometry.js';

function overlaps(a, b) {
  const [aw, ah] = cardSize(a.type), [bw, bh] = cardSize(b.type);
  return a.x < b.x + bw + 12 && a.x + aw + 12 > b.x &&
    a.y < b.y + bh + 12 && a.y + ah + 12 > b.y;
}

test('a seed repeats the same settlement without disturbing existing places', () => {
  const existing = [{ type: 'house', name: 'The Old Cottage', x: 340, y: 265 }];
  const first = planDetails('town', 'ash coast', 'standard', existing);
  const second = planDetails('town', 'ash coast', 'standard', existing);
  assert.deepEqual(first, second);
  assert.ok(first.length > 0 && first.length <= 11);
  assert.ok(first.some(item => item.type === 'house'));
  assert.ok(first.every(item => !overlaps(item, existing[0])));
  for (let i = 0; i < first.length; i++) {
    for (let j = i + 1; j < first.length; j++) assert.equal(overlaps(first[i], first[j]), false);
  }
});

test('house plans produce rooms that fit within the interior map', () => {
  const rooms = planDetails('house', 'lantern', 'large');
  assert.equal(rooms.length, 7);
  for (const room of rooms) {
    assert.equal(room.type, 'room');
    assert.ok(room.x >= 0 && room.x + cardSize(room.type)[0] <= 1010);
    assert.ok(room.y >= 0 && room.y + cardSize(room.type)[1] <= 630);
  }
});
