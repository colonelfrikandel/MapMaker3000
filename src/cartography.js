// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
// Deterministic, code-native map artwork. All SVG strings contain generated numbers only.
import { cardSize } from './geometry.js';

function hash(value) {
  let h = 2166136261;
  for (const char of value) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(seed) {
  let state = seed || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const n = value => Number(value.toFixed(1));
const path = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join(' ') + ' Z';
function coast(w, h, rand, inset = 8) {
  const points = [], cx = w / 2, cy = h / 2;
  const count = 35;
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    const wobble = .83 + rand() * .29;
    points.push([cx + Math.cos(angle) * (w / 2 - inset) * wobble,
      cy + Math.sin(angle) * (h / 2 - inset) * wobble]);
  }
  return path(points);
}
function trees(rand, count, w, h, color = '#496f54') {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = n(22 + rand() * (w - 44)), y = n(20 + rand() * (h - 42));
    const r = n(2.3 + rand() * 2.1);
    out += `<path d="M${x} ${n(y + r + 2)}v-4" stroke="#524c36" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#334b3d" stroke-width=".6"/>`;
  }
  return out;
}
function mountains(rand, count, w, h) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = n(28 + rand() * (w - 56)), y = n(22 + rand() * (h - 48)), size = n(5 + rand() * 6);
    out += `<path d="M${n(x-size)} ${n(y+size*.6)}L${x} ${n(y-size)}L${n(x+size)} ${n(y+size*.6)}Z" fill="#8b927d" stroke="#4f594c" stroke-width="1"/><path d="M${x} ${n(y-size)}l-2 4 2-1 2 1Z" fill="#e8dfc8"/>`;
  }
  return out;
}
function land(w, h, rand, type) {
  const outline = coast(w, h, rand, type === 'continent' ? 9 : 5);
  const inner = coast(w * .79, h * .77, rand, 5);
  const x = n(w * .105), y = n(h * .115);
  const fill = type === 'continent' ? '#c3c596' : '#d1c59b';
  let out = `<path d="${outline}" fill="${fill}" stroke="#536c67" stroke-width="2.3"/><path d="${outline}" fill="none" stroke="#f1e6bd" stroke-width="1" transform="translate(0 2)" opacity=".55"/>`;
  out += `<path d="${inner}" transform="translate(${x} ${y})" fill="none" stroke="#817f5e" stroke-width=".7" stroke-dasharray="2 4" opacity=".55"/>`;
  out += `<path d="M${n(w*.11)} ${n(h*.62)} Q${n(w*.32)} ${n(h*.54)} ${n(w*.47)} ${n(h*.68)} T${n(w*.83)} ${n(h*.47)}" fill="none" stroke="#5c8790" stroke-width="2" opacity=".8"/>`;
  out += trees(rand, type === 'continent' ? 18 : 13, w, h);
  out += mountains(rand, type === 'continent' ? 8 : 5, w, h);
  return out;
}
function settlement(w, h, rand, town) {
  const cx = w / 2, cy = h * .43;
  let out = `<path d="M${n(w*.1)} ${n(h*.53)} Q${n(w*.35)} ${n(h*.41)} ${n(w*.53)} ${n(h*.51)} T${n(w*.93)} ${n(h*.33)}" fill="none" stroke="#b9a27a" stroke-width="8" stroke-linecap="round"/><path d="M${n(w*.1)} ${n(h*.53)} Q${n(w*.35)} ${n(h*.41)} ${n(w*.53)} ${n(h*.51)} T${n(w*.93)} ${n(h*.33)}" fill="none" stroke="#eee2bf" stroke-width="4" stroke-linecap="round"/>`;
  if (town) out += `<path d="M${n(cx-45)} ${n(cy-30)} Q${n(cx)} ${n(cy-47)} ${n(cx+46)} ${n(cy-28)} L${n(cx+48)} ${n(cy+28)} Q${n(cx)} ${n(cy+47)} ${n(cx-46)} ${n(cy+29)}Z" fill="#d6c59c" fill-opacity=".35" stroke="#655740" stroke-width="2.2" stroke-dasharray="12 3"/>`;
  const count = town ? 36 : 16;
  for (let i = 0; i < count; i++) {
    const x = n(cx - (town ? 43 : 32) + rand() * (town ? 86 : 64));
    const y = n(cy - (town ? 30 : 21) + rand() * (town ? 60 : 42));
    const bw = n(4 + rand() * 6), bh = n(3 + rand() * 4);
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${i % 4 ? '#9b6750' : '#625e4c'}" stroke="#473e36" stroke-width=".7" transform="rotate(${n((rand()-.5)*20)} ${x} ${y})"/>`;
  }
  if (town) out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="4" fill="#e3d4ae" stroke="#574b3e" stroke-width="1.5"/>`;
  return out;
}
function house(w, h, rand) {
  const x = n(w*.24), y = n(h*.2), bw = n(w*.52), bh = n(h*.53);
  const roof = rand() > .5 ? '#a16b52' : '#805d4b';
  return `<path d="M${n(w*.1)} ${n(h*.73)} Q${n(w*.44)} ${n(h*.62)} ${n(w*.88)} ${n(h*.8)}" fill="none" stroke="#b9a77f" stroke-width="5"/>`+
    `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#e1cdab" stroke="#4e463a" stroke-width="2"/>`+
    `<path d="M${x} ${y}L${n(x+bw*.5)} ${n(y-11)}L${n(x+bw)} ${y}L${n(x+bw)} ${n(y+bh)}L${n(x+bw*.5)} ${n(y+bh+9)}L${x} ${n(y+bh)}Z" fill="${roof}" stroke="#4e3d34" stroke-width="1.5"/>`+
    `<path d="M${n(x+bw*.5)} ${n(y-11)}V${n(y+bh+9)}" stroke="#e2b99a" stroke-width="1.2"/>`+
    `<rect x="${n(x+bw*.69)}" y="${n(y+3)}" width="7" height="7" fill="#665147" stroke="#443a34" stroke-width="1"/>`;
}
function room(w, h, rand, name) {
  const x = 11, y = 10, bw = w-22, bh = h-29, door = n(w*.48);
  let out = `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#d8c5a1" stroke="#66533d" stroke-width="5"/>`;
  out += `<path d="M${door} ${n(y+bh)}h21" stroke="#d8c5a1" stroke-width="7"/><path d="M${door} ${n(y+bh)}v-19a19 19 0 0 1 19 19" fill="none" stroke="#6d5a43" stroke-width="1.5"/>`;
  out += `<path d="M20 20h${n(w-40)}M20 ${n(h*.43)}h${n(w-40)}M20 ${n(h*.7)}h${n(w-40)}" stroke="#bda987" stroke-width=".7" opacity=".55"/>`;
  const lower = name.toLowerCase();
  if (/bed|sleep|chamber/.test(lower)) {
    out += `<rect x="20" y="24" width="40" height="29" rx="2" fill="#8b6652" stroke="#534336" stroke-width="1.5"/><rect x="22" y="27" width="11" height="23" fill="#e6d9bb"/><rect x="35" y="27" width="22" height="23" fill="#aa8e79"/>`;
  } else if (/cellar|store|pantry/.test(lower)) {
    for (let i=0;i<3;i++) out += `<rect x="${24+i*24}" y="24" width="17" height="17" fill="#af885b" stroke="#614b35" stroke-width="1.5"/><path d="M${28+i*24} 24v17" stroke="#74583e"/>`;
  } else {
    out += `<ellipse cx="${n(w*.49)}" cy="${n(h*.45)}" rx="20" ry="12" fill="#956d4b" stroke="#58412f" stroke-width="2"/><circle cx="${n(w*.49)}" cy="${n(h*.45)}" r="5" fill="#bd9b69"/>`;
    out += `<rect x="20" y="22" width="28" height="8" fill="#866c50" stroke="#574734" stroke-width="1"/>`;
  }
  out += `<rect x="${n(w-37)}" y="22" width="15" height="15" fill="#987d5a" stroke="#614b35" stroke-width="1.5"/>`;
  return out;
}
function landmark(w, h, rand) {
  const x = n(w/2), y = n(h*.4);
  const kind = Math.floor(rand()*3);
  let out = `<circle cx="${x}" cy="${y}" r="23" fill="#d4ca9e" fill-opacity=".6" stroke="#766f54" stroke-width="1" stroke-dasharray="2 3"/>`;
  if (kind === 0) out += `<circle cx="${x}" cy="${y}" r="11" fill="#71939a" stroke="#504c40" stroke-width="3"/><circle cx="${x}" cy="${y}" r="5" fill="#c9d3c8"/>`;
  else if (kind === 1) out += `<path d="M${n(x-12)} ${n(y+14)}L${n(x-9)} ${n(y-11)}L${n(x+8)} ${n(y-11)}L${n(x+12)} ${n(y+14)}Z" fill="#a49b7b" stroke="#534c3d" stroke-width="2"/><path d="M${n(x-14)} ${n(y-13)}h28" stroke="#534c3d" stroke-width="4"/>`;
  else out += `<path d="M${n(x-13)} ${n(y+10)}L${x} ${n(y-16)}L${n(x+13)} ${n(y+10)}Z" fill="#a16b52" stroke="#534336" stroke-width="2"/><path d="M${x} ${n(y-16)}v27" stroke="#534336" stroke-width="2"/>`;
  return out;
}

export function artworkForPlace(item) {
  const [w, h] = cardSize(item.type);
  const rand = random(hash(`${item.type}:${item.name}:${item.provenance?.seed || ''}`));
  let art;
  if (['continent', 'province', 'region'].includes(item.type)) art = land(w, h, rand, item.type);
  else if (item.type === 'town' || item.type === 'village') art = settlement(w, h, rand, item.type === 'town');
  else if (item.type === 'house') art = house(w, h, rand);
  else if (item.type === 'room') art = room(w, h, rand, item.name);
  else art = landmark(w, h, rand);
  return `<svg class="place-art" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${art}</svg>`;
}

export function artworkForBoard(board, atlas) {
  if (!['town', 'village', 'house'].includes(board.kind)) return '';
  const rand = random(hash(`${board.kind}:${board.name}`));
  if (board.kind === 'house') {
    let floor = `<rect x="76" y="51" width="858" height="526" fill="#c6b18d" stroke="#5c4b37" stroke-width="15"/>`;
    floor += `<rect x="90" y="65" width="830" height="498" fill="#dbc8a6" stroke="#9e8767" stroke-width="2"/>`;
    for (let y=90; y<560; y+=31) floor += `<path d="M96 ${y}H914" stroke="#bda988" stroke-width="1" opacity=".45"/>`;
    const rooms = board.placeIds.map(id => atlas.places[id]).filter(item => item?.type === 'room');
    for (let i=1;i<rooms.length;i++) {
      const a = rooms[i-1], b = rooms[i];
      const x1 = n(a.x+90), y1 = n(a.y+67), x2 = n(b.x+90), y2 = n(b.y+67);
      const route = `M${x1} ${y1}H${x2}V${y2}`;
      floor += `<path d="${route}" fill="none" stroke="#69543b" stroke-width="35" stroke-linejoin="round"/><path d="${route}" fill="none" stroke="#dfcba5" stroke-width="28" stroke-linejoin="round"/>`;
    }
    return `<svg viewBox="0 0 1010 630" aria-hidden="true">${floor}</svg>`;
  }
  const town = board.kind === 'town';
  const places = board.placeIds.map(id => atlas.places[id]).filter(Boolean);
  const centers = places.map(item => {
    const [w, h] = cardSize(item.type);
    return { x: item.x + w/2, y: item.y + h/2, item };
  });
  const anchor = centers.find(point => point.item.type === 'landmark') || { x: 505, y: 315 };
  const roads = [
    { x1: -20, y1: anchor.y, x2: anchor.x, y2: anchor.y },
    { x1: anchor.x, y1: anchor.y, x2: 1030, y2: n(anchor.y - 90) },
  ];
  // A nearest-neighbor street tree keeps every editable place on the road network.
  const connected = [anchor], remaining = centers.filter(point => point !== anchor);
  while (remaining.length) {
    let best = { distance: Infinity, index: -1, from: null };
    for (let i=0;i<remaining.length;i++) for (const from of connected) {
      const distance = (remaining[i].x-from.x)**2 + (remaining[i].y-from.y)**2;
      if (distance < best.distance) best = { distance, index: i, from };
    }
    const to = remaining.splice(best.index, 1)[0];
    roads.push({ x1: best.from.x, y1: best.from.y, x2: to.x, y2: to.y });
    connected.push(to);
  }
  const wall = 'M41 113 Q280 24 517 79 T973 132 L970 524 Q660 627 399 574 T41 513Z';
  let art = `<path d="${wall}" fill="#d9d0ae" fill-opacity=".7" stroke="#77775e" stroke-width="${town ? 5 : 2}" stroke-dasharray="${town ? '22 4' : '4 9'}"/>`;
  const roadPaths = roads.map(({x1,y1,x2,y2}, index) => {
    const bend = index < 2 ? 0 : n((rand()-.5)*38);
    return `M${n(x1)} ${n(y1)} Q${n((x1+x2)/2+bend)} ${n((y1+y2)/2-bend)} ${n(x2)} ${n(y2)}`;
  });
  for (const road of roadPaths) art += `<path d="${road}" fill="none" stroke="#ab9672" stroke-width="${town ? 17 : 12}" stroke-linecap="round"/><path d="${road}" fill="none" stroke="#e9dcba" stroke-width="${town ? 11 : 7}" stroke-linecap="round"/>`;
  function nearRoad(x, y) {
    return roads.some(({x1,y1,x2,y2}) => {
      const dx = x2-x1, dy = y2-y1;
      const t = Math.max(0, Math.min(1, ((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy || 1)));
      return Math.hypot(x-(x1+t*dx), y-(y1+t*dy)) < 16;
    });
  }
  const count = town ? 180 : 95;
  for (let i=0;i<count;i++) {
    const x = n(64 + rand()*870), y = n(90 + rand()*440);
    const w = n(7+rand()*12), h = n(6+rand()*10);
    if (nearRoad(x+w/2,y+h/2) || places.some(item => {
      const [pw,ph] = cardSize(item.type);
      return x < item.x+pw+6 && x+w+6 > item.x && y < item.y+ph+6 && y+h+6 > item.y;
    })) continue;
    art += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${rand()>.5?'#957159':'#806b55'}" stroke="#554b3e" stroke-width="1" transform="rotate(${n((rand()-.5)*12)} ${x} ${y})"/>`;
  }
  art += trees(rand, town ? 48 : 70, 1010, 630, '#708367');
  return `<svg viewBox="0 0 1010 630" aria-hidden="true">${art}</svg>`;
}
