// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
// A single world coastline with soft terrain fields shared by neighboring realms.
const W = 1010, H = 630;
const PALETTE = {
  forest: '#5c765b', plains: '#a9b685', highland: '#a7a185', snow: '#dbe0d5',
  desert: '#d7bd88', marsh: '#78968a', coast: '#cbbf8e', mixed: '#a9aa81',
};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const n = v => Math.round(v*10)/10;
const softLimit = (value,center,radius) => {
  const delta=value-center;
  return center+delta/(1+(Math.abs(delta)/radius)**8)**(1/8);
};
function hash(value) { let h=2166136261; for (const c of value) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function rngFor(value) {
  let state=hash(value);
  return () => { state+=0x6d2b79f5; let x=state; x=Math.imul(x^x>>>15,x|1); x^=x+Math.imul(x^x>>>7,x|61); return ((x^x>>>14)>>>0)/4294967296; };
}
function path(points) { return `M${points.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')}Z`; }
function contains(poly,x,y) {
  let inside=false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function outline(regions,seed,padding) {
  const cx=regions.reduce((s,r)=>s+r.x,0)/regions.length;
  const cy=regions.reduce((s,r)=>s+r.y,0)/regions.length;
  const phase=hash(seed)%6283/1000;
  const distances=[];
  for (let i=0;i<160;i++) {
    const a=i*Math.PI*2/160, ux=Math.cos(a), uy=Math.sin(a);
    let distance=0;
    for (const r of regions) {
      const dx=r.x-cx,dy=r.y-cy;
      const along=dx*ux+dy*uy, cross=Math.abs(dx*uy-dy*ux);
      const radius=r.radius+padding;
      if (cross<radius) distance=Math.max(distance,along+Math.sqrt(radius*radius-cross*cross));
    }
    distances.push(distance);
  }
  const points=[];
  for (let i=0;i<160;i++) {
    const a=i*Math.PI*2/160, ux=Math.cos(a), uy=Math.sin(a);
    let total=0,weight=0;
    for (let k=-5;k<=5;k++) {
      const w=Math.exp(-k*k/10);
      total+=distances[(i+k+160)%160]*w;weight+=w;
    }
    const distance=total/weight;
    const wobble=1+.045*Math.sin(3*a+phase)+.028*Math.sin(7*a-phase*1.7)+.017*Math.sin(13*a+phase*2);
    points.push([softLimit(cx+ux*distance*wobble,W/2,W/2-20),softLimit(cy+uy*distance*wobble,H/2,H/2-20)]);
  }
  return points;
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

export function worldLandShape(realms, seed='world') {
  const regions=realms.map(r=>{
    const rand=rngFor(`${seed}:${r.name}`);
    const radius=clamp(r.radius||125,65,180)*(r.island ? .84+rand()*.17 : .85+rand()*.27);
    return { ...r, radius };
  });
  const mainland=regions.filter(r=>!r.island);
  const land=mainland.length ? outline(mainland,seed,18) : [];
  const islands=regions.filter(r=>r.island).map(r=>outline([r],`${seed}:${r.name}`,0));
  return { land, islands };
}

export function worldSvg(realms,seed='world') {
  const regions=realms.map(r=>({ ...r, radius:clamp(r.radius||125,65,180), biome:PALETTE[r.biome]?r.biome:'mixed' }));
  const {land,islands}=worldLandShape(regions,seed);
  const shapes=[land,...islands].filter(p=>p.length);
  const shapePath=shapes.map(path).join('');
  const rand=rngFor(seed);
  const suffix=hash(seed).toString(36);
  let defs=`<clipPath id="world-land-clip-${suffix}"><path d="${shapePath}"/></clipPath><clipPath id="world-main-clip-${suffix}"><path d="${land.length?path(land):''}"/></clipPath><clipPath id="world-islands-clip-${suffix}"><path d="${islands.map(path).join('')}"/></clipPath>`;
  for (const [i,r] of regions.entries()) defs+=`<radialGradient id="realm-biome-${suffix}-${i}" gradientUnits="userSpaceOnUse" cx="${n(r.x)}" cy="${n(r.y)}" r="${n(r.radius*2.3)}"><stop offset="0" stop-color="${PALETTE[r.biome]}" stop-opacity=".95"/><stop offset=".55" stop-color="${PALETTE[r.biome]}" stop-opacity=".6"/><stop offset="1" stop-color="${PALETTE[r.biome]}" stop-opacity="0"/></radialGradient>`;
  let svg=`<defs>${defs}</defs><rect width="${W}" height="${H}" fill="#7f9dae"/><path d="${shapePath}" fill="#b9b693" stroke="#405450" stroke-width="4" stroke-linejoin="round"/>`;
  svg+=`<g clip-path="url(#world-land-clip-${suffix})">`;
  for (const [i,r] of regions.entries()) svg+=`<rect width="${W}" height="${H}" fill="url(#realm-biome-${suffix}-${i})" clip-path="url(#world-${r.island?'islands':'main'}-clip-${suffix})"/>`;
  for (let i=0;i<430;i++) {
    const x=20+rand()*(W-40),y=18+rand()*(H-36);
    const onMain=land.length && contains(land,x,y);
    if (!onMain && !islands.some(poly=>contains(poly,x,y))) continue;
    const biome=biomeAt(regions.filter(r=>!!r.island!==!!onMain),x,y,rand());
    if (rand()<(biome==='plains'?.47:.25)) continue;
    svg+=symbol(biome,x,y,3+rand()*5);
  }
  svg+='</g>';
  svg+=`<path d="${shapePath}" fill="none" stroke="#ebe2bb" stroke-width="1.5" stroke-linejoin="round" opacity=".85"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${svg}</svg>`;
}
