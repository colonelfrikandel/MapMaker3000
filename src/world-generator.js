// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
// A single world coastline with soft terrain fields shared by neighboring realms.
import { terrainContours } from './landmass.js?v=layered-forest-1';
import { independentShape, continentSvg } from './continent.js';
const COAST_SAMPLES = 256;
export const ISLAND_WATER_GAP = 18;
// Extra space accounts for the shoreline strokes on both sides of the water.
const ISLAND_CUTOUT_RADIUS = ISLAND_WATER_GAP + 4;
const PALETTE = {
  forest: '#5c765b', plains: '#a9b685', highland: '#a7a185', snow: '#dbe0d5',
  desert: '#d7bd88', marsh: '#78968a', coast: '#cbbf8e', mixed: '#a9aa81',
};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const n = v => Math.round(v*10)/10;
function hash(value) { let h=2166136261; for (const c of value) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function rngFor(value) {
  let state=hash(value);
  return () => { state+=0x6d2b79f5; let x=state; x=Math.imul(x^x>>>15,x|1); x^=x+Math.imul(x^x>>>7,x|61); return ((x^x>>>14)>>>0)/4294967296; };
}
function path(points) { return `M${points.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')}Z`; }
const polygonBoundsCache=new WeakMap();
function polygonBounds(poly) {
  if(polygonBoundsCache.has(poly)) return polygonBoundsCache.get(poly);
  const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
  for(const [x,y] of poly) { bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y); }
  polygonBoundsCache.set(poly,bounds);return bounds;
}
function nearPolygon(poly,x,y,margin=0) {
  const b=polygonBounds(poly);
  return x>=b.left-margin && x<=b.right+margin && y>=b.top-margin && y<=b.bottom+margin;
}
function contains(poly,x,y) {
  if(!nearPolygon(poly,x,y)) return false;
  let inside=false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function outline(regions,seed) {
  const r=regions[0],rand=rngFor(seed);
  const phases=Array.from({length:6},()=>rand()*Math.PI*2);
  const waves=[2,3,7,15,31,63],amplitudes=[.17,.13,.08,.035,.016,.007];
  return Array.from({length:COAST_SAMPLES},(_,i)=>{
    const angle=i*Math.PI*2/COAST_SAMPLES;
    const radius=r.radius*(1+waves.reduce((sum,f,j)=>sum+Math.sin(angle*f+phases[j])*amplitudes[j],0));
    return [r.x+Math.cos(angle)*radius,r.y+Math.sin(angle)*radius];
  });
}
function biomeAt(regions,x,y,roll) {
  if (!regions.length) return 'mixed';
  const weighted=[];let total=0;
  for (const r of regions) {
    const dx=(x-r.x)/r.radius,dy=(y-r.y)/r.radius;
    const weight=Math.exp(-1.6*(dx*dx+dy*dy));
    total+=weight;weighted.push([r.biome,weight]);
  }
  let target=roll*total;
  for (const [biome,weight] of weighted) { target-=weight; if (target<=0) return biome; }
  return weighted.at(-1)[0];
}
function symbol(type,x,y,s) {
  x=n(x);y=n(y);s=n(s);
  if (type==='forest') return `<path d="M${n(x-s)} ${n(y+s)}L${x} ${n(y-s)}L${n(x+s)} ${n(y+s)}Z" fill="#405b48" stroke="#344639" stroke-width=".7"/><path d="M${x} ${n(y+s)}v${n(s*.5)}" stroke="#655b42" stroke-width="1"/>`;
  if (type==='snow'||type==='highland') return `<path d="M${n(x-s)} ${n(y+s*.6)}L${x} ${n(y-s)}L${n(x+s)} ${n(y+s*.6)}Z" fill="${type==='snow'?'#bfc7c4':'#8d8a77'}" stroke="#5f625b" stroke-width=".9"/><path d="M${x} ${n(y-s)}l${n(-s*.3)} ${n(s*.5)}h${n(s*.6)}Z" fill="#edece0"/>`;
  if (type==='desert'||type==='coast') return `<path d="M${n(x-s)} ${y}q${s} ${n(-s*.7)} ${n(2*s)} 0" fill="none" stroke="#9f8d68" stroke-width="1.2"/>`;
  if (type==='marsh') return `<path d="M${n(x-s)} ${y}h${n(2*s)}m${n(-s)} ${n(s*.4)}v${n(-s*1.2)}" stroke="#4f7066" stroke-width="1"/>`;
  return `<path d="M${n(x-s)} ${y}l${n(s*.4)} ${n(-s*.6)}m${n(s*.1)} ${n(s*.6)}l${n(s*.5)} ${n(-s*.8)}" fill="none" stroke="#657c55" stroke-width="1"/>`;
}

export function worldBounds(realms) {
  let left=0,top=0,right=1010,bottom=630;
  for(const r of realms) {
    const padding=Math.max(360,(r.radius || 150)*2.5);
    left=Math.min(left,r.x-padding);top=Math.min(top,r.y-padding);
    right=Math.max(right,r.x+padding);bottom=Math.max(bottom,r.y+padding);
  }
  return {x:left,y:top,width:right-left,height:bottom-top};
}
const shapeCache=new Map();
export function worldLandShape(realms, seed='world', world=null) {
  if(world?.mode==='independent') return independentShape(world);
  const key=JSON.stringify([seed,realms.map(r=>[r.x,r.y,r.radius,!!r.island])]);
  if(shapeCache.has(key)) return shapeCache.get(key);
  const regions=realms.map(r=>{
    const rand=rngFor(`${seed}:${r.x}:${r.y}`);
    const radius=clamp(r.radius||125,65,180)*(r.island ? .84+rand()*.17 : .85+rand()*.27);
    return { ...r, radius };
  });
  const mainland=regions.filter(r=>!r.island);
  const islands=regions.filter(r=>r.island).map(r=>outline([r],`${seed}:${r.x}:${r.y}`,0));
  const terrain=terrainContours(mainland,hash(seed));
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const ring of [...terrain.rings,...islands]) for(const [x,y] of ring) {
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  const bounds=Number.isFinite(left)?{x:left-50,y:top-50,width:right-left+100,height:bottom-top+100}:worldBounds(realms);
  const result={land:terrain.rings[0] || [],landRings:terrain.rings,islands,
    bounds,samples:terrain.samples,step:terrain.step};
  shapeCache.set(key,result);
  if(shapeCache.size>4) shapeCache.delete(shapeCache.keys().next().value);
  return result;
}

function pointSegmentDistanceSquared(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy || 1),0,1);
  return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
}
function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }

// Check the complete polygon boundaries, including containment and edge
// crossings. Vertex-only tests miss narrow channels and long crossing edges.
export function coastlinesSeparated(a,b,gap=ISLAND_WATER_GAP) {
  if (!a.length || !b.length) return true;
  const ab=polygonBounds(a),bb=polygonBounds(b);
  if(ab.right+gap<bb.left || bb.right+gap<ab.left || ab.bottom+gap<bb.top || bb.bottom+gap<ab.top) return true;
  if (contains(a,...b[0]) || contains(b,...a[0])) return false;
  const limit=gap*gap;
  for (let i=0;i<a.length;i++) {
    const p=a[i],q=a[(i+1)%a.length];
    for (let j=0;j<b.length;j++) {
      const r=b[j],s=b[(j+1)%b.length];
      if (Math.max(p[0],q[0])+gap<Math.min(r[0],s[0]) ||
          Math.max(r[0],s[0])+gap<Math.min(p[0],q[0]) ||
          Math.max(p[1],q[1])+gap<Math.min(r[1],s[1]) ||
          Math.max(r[1],s[1])+gap<Math.min(p[1],q[1])) continue;
      if (cross(p,q,r)*cross(p,q,s)<0 && cross(r,s,p)*cross(r,s,q)<0) return false;
      if (Math.min(pointSegmentDistanceSquared(p,r,s),pointSegmentDistanceSquared(q,r,s),
        pointSegmentDistanceSquared(r,p,q),pointSegmentDistanceSquared(s,p,q))<=limit) return false;
    }
  }
  return true;
}

export function worldIslandConflicts(realms,seed='world') {
  const {islands}=worldLandShape(realms.filter(r=>r.island),seed);
  const islandRealms=realms.filter(r=>r.island);
  const conflicts=[];
  islands.forEach((island,i)=>{
    for (let j=0;j<i;j++) if (!coastlinesSeparated(islands[j],island)) {
      conflicts.push(`${islandRealms[i].name} and ${islandRealms[j].name} need more open water between them.`);
    }
  });
  return conflicts;
}

// Mainland geometry excludes an island and its surrounding water, even when
// the island lies entirely inside the outer mainland coastline.
export function worldSurfaceAt({land,landRings=[land],islands,lakes=[]},x,y) {
  if(lakes.some(lake=>contains(lake.points,x,y)&&!(lake.holes||[]).some(h=>contains(h,x,y))))return {kind:'water'};
  const islandIndex=islands.findIndex(poly=>contains(poly,x,y));
  if (islandIndex>=0) return {kind:'island',islandIndex};
  for (const poly of islands) {
    if(!nearPolygon(poly,x,y,ISLAND_CUTOUT_RADIUS)) continue;
    for (let i=0;i<poly.length;i++) if (pointSegmentDistanceSquared([x,y],poly[i],poly[(i+1)%poly.length])<=ISLAND_CUTOUT_RADIUS**2) return {kind:'water'};
  }
  return {kind:landRings.reduce((inside,ring)=>inside!==contains(ring,x,y),false)?'mainland':'water'};
}

export function worldSvg(realms,seed='world',world=null) {
  if(world?.mode==='independent') return continentSvg(world);
  const regions=realms.map(r=>({ ...r, radius:clamp(r.radius||125,65,180), biome:PALETTE[r.biome]?r.biome:'mixed' }));
  const shape=worldLandShape(regions,seed);
  const {land,islands}=shape;
  const mainPath=shape.landRings.map(path).join('');
  const {x:bx,y:by,width:W,height:H}=shape.bounds;
  const rect=`x="${bx}" y="${by}" width="${W}" height="${H}"`;
  const shapes=[...shape.landRings,...islands].filter(p=>p.length);
  const shapePath=shapes.map(path).join('');
  const rand=rngFor(seed);
  const suffix=hash(seed).toString(36);
  let defs=`<clipPath id="world-land-clip-${suffix}"><path d="${shapePath}"/></clipPath><clipPath id="world-main-clip-${suffix}"><path d="${mainPath}" clip-rule="evenodd"/></clipPath><clipPath id="world-islands-clip-${suffix}"><path d="${islands.map(path).join('')}"/></clipPath>`;
  const islandPath=islands.map(path).join('');
  defs+=`<mask id="world-main-water-${suffix}" maskUnits="userSpaceOnUse" ${rect} style="mask-type:luminance"><rect ${rect} fill="white"/><path d="${islandPath}" fill="black" stroke="black" stroke-width="${ISLAND_CUTOUT_RADIUS*2}" stroke-linejoin="round"/></mask>`;
  islands.forEach((island,i)=>{ defs+=`<clipPath id="world-island-${suffix}-${i}"><path d="${path(island)}"/></clipPath>`; });
  for (const [i,r] of regions.entries()) defs+=`<radialGradient id="realm-biome-${suffix}-${i}" gradientUnits="userSpaceOnUse" cx="${n(r.x)}" cy="${n(r.y)}" r="${n(r.radius*2.3)}"><stop offset="0" stop-color="${PALETTE[r.biome]}" stop-opacity=".95"/><stop offset=".55" stop-color="${PALETTE[r.biome]}" stop-opacity=".6"/><stop offset="1" stop-color="${PALETTE[r.biome]}" stop-opacity="0"/></radialGradient>`;
  let mainSymbols='',islandSymbols=islands.map(()=> '');
  for (let i=0;i<Math.min(1600,regions.length*140);i++) {
    const anchor=regions[i%regions.length];
    const x=anchor.x+(rand()-.5)*anchor.radius*3,y=anchor.y+(rand()-.5)*anchor.radius*3;
    const surface=worldSurfaceAt(shape,x,y);
    if (surface.kind==='water') continue;
    const candidates=surface.kind==='mainland' ? regions.filter(r=>!r.island) : [regions.filter(r=>r.island)[surface.islandIndex]];
    const biome=biomeAt(candidates,x,y,rand());
    if (rand()<(biome==='plains'?.47:.25)) continue;
    const art=symbol(biome,x,y,3+rand()*5);
    if (surface.kind==='mainland') mainSymbols+=art;
    else islandSymbols[surface.islandIndex]+=art;
  }
  const coastline=poly=>`<path d="${path(poly)}" fill="none" stroke="#405450" stroke-width="4" stroke-linejoin="round"/><path d="${path(poly)}" fill="none" stroke="#ebe2bb" stroke-width="1.5" stroke-linejoin="round" opacity=".85"/>`;
  let svg=`<defs>${defs}</defs>`;
  if (land.length) {
    svg+=`<g mask="url(#world-main-water-${suffix})"><path d="${mainPath}" fill="#b9b693" fill-rule="evenodd"/><g clip-path="url(#world-main-clip-${suffix})">`;
    for (const [i,r] of regions.entries()) if (!r.island) svg+=`<rect x="${r.x-r.radius*2.3}" y="${r.y-r.radius*2.3}" width="${r.radius*4.6}" height="${r.radius*4.6}" fill="url(#realm-biome-${suffix}-${i})"/>`;
    svg+=mainSymbols;
    // Only the outer edge of these wide strokes survives the water mask,
    // producing a lake shore that follows the island's irregular coastline.
    svg+=`<path d="${islandPath}" fill="none" stroke="#405450" stroke-width="${ISLAND_CUTOUT_RADIUS*2+4}" stroke-linejoin="round"/><path d="${islandPath}" fill="none" stroke="#ebe2bb" stroke-width="${ISLAND_CUTOUT_RADIUS*2+1.5}" stroke-linejoin="round"/>`;
    svg+=`</g>${shape.landRings.map(coastline).join('')}</g>`;
  }
  let islandIndex=0;
  for (const [i,r] of regions.entries()) if (r.island) {
    const island=islands[islandIndex];
    svg+=`<g clip-path="url(#world-island-${suffix}-${islandIndex})"><path d="${path(island)}" fill="#b9b693"/><rect ${rect} fill="url(#realm-biome-${suffix}-${i})"/>${islandSymbols[islandIndex]}</g>${coastline(island)}`;
    islandIndex++;
  }
  return `<svg viewBox="${bx} ${by} ${W} ${H}" style="background:#7f9dae" aria-hidden="true">${svg}</svg>`;
}
