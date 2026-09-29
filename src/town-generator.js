// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
// Original, seeded settlement geometry. Coordinates are local to a 1010 × 630 board.
const W = 1010, H = 630;
import { generateVillage } from './village-generator.js';
const round = n => Math.round(n * 10) / 10;
const point = (x, y) => [round(x), round(y)];

function randomFor(seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function ellipse(cx, cy, rx, ry, count, phase = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = phase + i * Math.PI * 2 / count;
    return point(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
  });
}

function rectangle(cx, cy, width, height, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sy]) =>
    point(cx + sx*width*c/2 - sy*height*s/2, cy + sx*width*s/2 + sy*height*c/2));
}

function line(points, width) { return { points: points.map(([x,y]) => point(x,y)), width }; }

export function generateTownBase(kind, seed, size = 'standard', reserved = [], options = {}) {
  if (!['town', 'village'].includes(kind) || !['small', 'standard', 'large'].includes(size)) throw new Error('Invalid town settings');
  if (kind === 'village') return generateVillage(seed, size, reserved, options);
  const rng = randomFor(`${kind}:${seed.trim()}:${size}`);
  const town = kind === 'town';
  const factor = { small: .74, standard: 1, large: 1.18 }[size];
  const cx = 505 + (rng()-.5)*70, cy = 314 + (rng()-.5)*42;
  const rx = (town ? 336 : 258)*factor, ry = (town ? 233 : 187)*factor;
  const spokes = town ? 8 : 6;
  const rings = town ? [0.33, 0.62, 0.9] : [0.48, 0.88];
  const phase = rng()*Math.PI*2;
  const bendA = rng()*Math.PI*2, bendB = rng()*Math.PI*2;
  const warp = angle => 1 + .065*Math.sin(3*angle+bendA) + .035*Math.sin(5*angle+bendB);
  const onRing = (angle, radius) => point(cx+Math.cos(angle)*rx*radius*warp(angle),cy+Math.sin(angle)*ry*radius*warp(angle));
  const layers = { earth: [], water: [], buildings: [], prisms: [], squares: [], greens: [], fields: [], walls: [],
    roads: [], rivers: [], planks: [], districts: [], trees: [] };

  // District wedges, a central square, ring streets and radial streets share one plan.
  const districtCount = town ? 5 : 3;
  const names = ['Old Quarter', 'Market Ward', 'High Ward', 'South Ward', 'Temple Ward', 'West End', 'Craft Ward'];
  for (let i=names.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [names[i],names[j]]=[names[j],names[i]]; }
  for (let i=0; i<districtCount; i++) {
    const a0 = phase + i*Math.PI*2/districtCount, a1 = phase + (i+1)*Math.PI*2/districtCount;
    const polygon = [point(cx,cy), ...Array.from({length:9}, (_,j) => {
      const a = a0 + (a1-a0)*j/8;
      return onRing(a,.98);
    })];
    layers.districts.push({ id: `district-${i}`, name: names[i], polygon });
  }
  layers.squares.push(ellipse(cx,cy,town ? 53 : 39,town ? 38 : 29,16));
  layers.greens.push(ellipse(cx+rx*.37,cy-ry*.38,rx*.13,ry*.11,12));
  layers.greens.push(ellipse(cx-rx*.41,cy+ry*.28,rx*.1,ry*.13,12));
  for (const radius of rings) {
    const points = Array.from({ length: 65 }, (_,i) => {
      const a=phase+i*Math.PI*2/64;
      return onRing(a,radius);
    });
    layers.roads.push(line(points,town ? 12 : 9));
  }
  for (let i=0;i<spokes;i++) {
    const a=phase+i*Math.PI*2/spokes;
    layers.roads.push(line([[cx,cy],onRing(a,.46),onRing(a,.86),onRing(a,1.23)],town ? 11 : 8));
  }
  if (town) layers.walls.push(Array.from({length:64},(_,i)=>onRing(phase+i*Math.PI*2/64,.99)));

  // Lots are laid out along the streets. Each footprint is its own editable target.
  const bandRadii = town ? [.45,.74,1.08] : [.62,1.09];
  const counts = town ? [54,86,96] : [38,52];
  for (const [band, radius] of bandRadii.entries()) {
    const count = Math.round(counts[band]*factor);
    for (let i=0;i<count;i++) {
      const angle=phase+(i+(rng()-.5)*.35)*Math.PI*2/count;
      const r=radius+(rng()-.5)*.065;
      const [x,y]=onRing(angle,r);
      if (x<28 || x>W-28 || y<24 || y>H-24) continue;
      // Leave a corridor for each radial street and a little room around parks.
      const spokeGap = Math.abs(((angle-phase+Math.PI*4)%(Math.PI*2/spokes))-(Math.PI/spokes));
      if (spokeGap > Math.PI/spokes-.065 || rng()<.1) continue;
      const width=(town ? 18 : 20)*(0.7+rng()*.65), height=(town ? 13 : 16)*(0.72+rng()*.55);
      layers.buildings.push(rectangle(x,y,width,height,angle+Math.PI/2+(rng()-.5)*.16));
    }
  }
  // A few rural holdings make the outer edge feel settled rather than clipped.
  for (let i=0;i<(town ? 26 : 18)*factor;i++) {
    const a=rng()*Math.PI*2, r=1.31+rng()*.16;
    const [x,y]=onRing(a,r);
    if (x<25 || x>W-25 || y<25 || y>H-25) continue;
    layers.buildings.push(rectangle(x,y,12+rng()*14,9+rng()*8,a+(rng()-.5)*.4));
  }
  for (let i=0;i<14;i++) {
    const a=phase+i*Math.PI*2/14;
    const [x,y]=onRing(a,1.48);
    layers.fields.push(rectangle(x,y,30+rng()*32,13+rng()*17,a));
  }
  for (let i=0;i<75;i++) {
    const x=25+rng()*(W-50), y=25+rng()*(H-50);
    const d=((x-cx)/rx)**2+((y-cy)/ry)**2;
    if (d>1.1 && d<2.5) layers.trees.push(point(x,y));
  }
  const base = { source:'mapmaker-generated', version:'1', seed, size, layers };
  return base;
}
