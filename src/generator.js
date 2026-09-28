import { cardSize } from './geometry.js';

const COUNTS = {
  town: { small: 7, standard: 11, large: 16 },
  village: { small: 4, standard: 6, large: 9 },
  house: { small: 3, standard: 5, large: 7 },
};
const HOUSE_NAMES = [
  'The Lantern Inn', 'Blacksmith’s Forge', 'Miller’s House', 'The Apothecary',
  'Cooper’s Yard', 'The Watch House', 'The Blue Door', 'Baker’s Hearth',
  'Tanner’s Cottage', 'Scribe’s House', 'The Amber Shop', 'The Old Stable',
  'The Weaver’s House', 'The Broken Wheel', 'The Mossy Roof', 'Carpenter’s Yard',
  'The Bell Tower', 'The Red Hearth', 'The Glassworks', 'The Wayfarer’s Rest',
];
const ROOM_NAMES = [
  'Entry hall', 'Kitchen', 'Common room', 'Bedroom', 'Study', 'Pantry',
  'Workshop', 'Guest room', 'Store room', 'Dining room', 'Attic', 'Cellar',
];
const TOWN_LANDMARKS = ['Market Square', 'Old Well', 'Watch Post', 'Temple Yard'];
const VILLAGE_LANDMARKS = ['Village Green', 'Old Well', 'Wayside Shrine', 'Meeting Oak'];

function seededRandom(seed) {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function overlaps(a, b) {
  const [aw, ah] = cardSize(a.type), [bw, bh] = cardSize(b.type), gap = 12;
  return a.x < b.x + bw + gap && a.x + aw + gap > b.x &&
    a.y < b.y + bh + gap && a.y + ah + gap > b.y;
}
function uniqueName(base, names) {
  if (!names.has(base)) { names.add(base); return base; }
  let number = 2;
  while (names.has(`${base} ${number}`)) number++;
  const result = `${base} ${number}`; names.add(result); return result;
}

export function canGenerate(kind) { return Object.hasOwn(COUNTS, kind); }

export function planDetails(kind, seed, size, existing = []) {
  if (!canGenerate(kind) || !Object.hasOwn(COUNTS[kind], size)) return [];
  const random = seededRandom(`${kind}:${seed.trim()}`);
  const occupied = existing.map(item => ({ type: item.type, x: item.x, y: item.y }));
  const names = new Set(existing.map(item => item.name));
  const isHouse = kind === 'house';
  const xs = isHouse ? [45, 285, 525, 765] : [60, 250, 440, 630, 820];
  const ys = isHouse ? [45, 245, 445] : [55, 195, 335, 475];
  const jitter = isHouse ? 12 : 8;
  const slots = shuffle(ys.flatMap(y => xs.map(x => ({
    x: x + Math.round((random() * 2 - 1) * jitter),
    y: y + Math.round((random() * 2 - 1) * jitter),
  }))), random);
  const houseNames = shuffle(isHouse ? ROOM_NAMES : HOUSE_NAMES, random);
  const landmarkNames = shuffle(kind === 'village' ? VILLAGE_LANDMARKS : TOWN_LANDMARKS, random);
  const target = COUNTS[kind][size];
  const plan = [];
  for (const slot of slots) {
    if (plan.length >= target) break;
    const type = isHouse ? 'room' : plan.length === 0 ? 'landmark' : 'house';
    const candidate = { type, x: slot.x, y: slot.y };
    if (occupied.some(other => overlaps(candidate, other))) continue;
    const base = type === 'landmark' ? landmarkNames[0] : houseNames[(plan.length - (isHouse ? 0 : 1)) % houseNames.length];
    const name = uniqueName(base, names);
    const description = type === 'landmark' ? 'A gathering place with stories to uncover.' :
      type === 'house' ? 'A place to explore; zoom inside to see its rooms.' : 'A room ready for your campaign details.';
    plan.push({ ...candidate, name, description });
    occupied.push(candidate);
  }
  return plan;
}
