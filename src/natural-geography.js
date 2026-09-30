import { forestSvg } from './forest-renderer.js';
import { seedStream } from './seeds.js';
import { sampleTerrainHeight, terrainElevation } from './terrain-heightmap.js';
import { contourField } from './landmass.js';
import { prepareBiomes, displayedBiomes, simplifyLine, simplifyRing } from './smooth-regions.js';

export const BIOME_COLORS={forest:'#555a48',grassland:'#b4b481',desert:'#cfb77f',snow:'#e2dfce',tundra:'#a9b09c',wetland:'#899e78',alpine:'#b2b2a0'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=v=>Math.round(v*100)/100 || 0;
export function containsPolygon(points,x,y) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}

// Priority flood assigns every land cell a downstream parent already visited.
// Depression filling provides lake levels and guarantees an acyclic outlet path.
export function drainTerrain(elevation,land,nx,ny) {
  const heap=[],seen=new Uint8Array(land.length),downstream=new Array(land.length).fill(-1),filled=[...elevation],order=[];
  function push(i) { heap.push(i);let k=heap.length-1;while(k){const p=(k-1)>>1;if(filled[heap[p]]<=filled[i])break;heap[k]=heap[p];k=p;}heap[k]=i; }
  function pop() { const result=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&filled[heap[c+1]]<filled[heap[c]])c++;if(filled[last]<=filled[heap[c]])break;heap[k]=heap[c];k=c;}heap[k]=last;}return result; }
  for(let i=0;i<land.length;i++) if(!land[i]) {seen[i]=1;push(i);}
  while(heap.length) {
    const i=pop();order.push(i);
    const x=i%nx,y=Math.floor(i/nx);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=nx||yy>=ny)continue;
      const j=yy*nx+xx;if(seen[j])continue;
      seen[j]=1;downstream[j]=i;filled[j]=Math.max(elevation[j],filled[i]+.01);push(j);
    }
  }
  return {filled,downstream,order};
}

function regions(mask,nx,ny,step,x,y,type,seed) {
  const rings=contourField(Float32Array.from(mask,v=>v?1:-1),nx,ny,step,x,y).rings;
  const result=[];
  for(let i=0;i<rings.length;i++) {
    const enclosing=[];
    for(let j=0;j<i;j++) if(containsPolygon(rings[j],...rings[i][0])) enclosing.push(j);
    if(enclosing.length%2) {
      const parent=result.find(r=>r.ring===enclosing.at(-1));if(parent)parent.holes.push(rings[i]);
    } else result.push({ring:i,points:rings[i],holes:[]});
  }
  return result.map(({points,holes},i)=>({id:`natural-${type}-${i}`,type,points,holes,editState:'generated',protected:false,provenance:{kind:'generator',seed,generatorVersion:'natural-1'}}));
}

export function generateNaturalGeography(world,seed=world.seed,options={}) {
  const coasts=Object.values(world.geography).filter(g=>g.type==='coastline').map(g=>g.points);
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const ring of coasts)for(const [x,y]of ring){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const step=Math.max(right-left,bottom-top)/96;
  left-=step*2;top-=step*2;right+=step*2;bottom+=step*2;
  const nx=Math.ceil((right-left)/step)+1,ny=Math.ceil((bottom-top)/step)+1,n=nx*ny;
  const land=new Array(n).fill(0),elevation=new Array(n).fill(0),temperature=new Array(n).fill(0),rainfall=new Array(n).fill(0);
  const rng=seedStream(seed,'natural-1'),phase=Array.from({length:6},()=>rng()*Math.PI*2);
  const point=i=>[left+(i%nx)*step,top+Math.floor(i/nx)*step];
  for(let i=0;i<n;i++) {
    const [x,y]=point(i),u=(x-left)/(right-left),v=(y-top)/(bottom-top);
    land[i]=Number(coasts.reduce((inside,ring)=>inside!==containsPolygon(ring,x,y),false));
    const ridge=Math.exp(-(((u-(.4+Math.sin(v*5+phase[0])*.16))/.065)**2));
    const second=Math.exp(-(((v-(.65+Math.sin(u*5+phase[1])*.12))/.07)**2));
    elevation[i]=land[i]?round(90+ridge*1800+second*900+170*(Math.sin(u*16+phase[2])*Math.cos(v*13+phase[3])+1)):0;
    if(world.terrainHeightmap) elevation[i]=land[i]?round(terrainElevation(sampleTerrainHeight(world.terrainHeightmap,world.settings,x,y))):0;
    temperature[i]=round(28-Math.abs(70-v*95)*.55-elevation[i]*.0065);
    const west=i%nx>0?elevation[i-1]:0;
    rainfall[i]=round(clamp(850+600*Math.sin(v*5+phase[4])+240*Math.cos(u*6+phase[5])+(elevation[i]-west)*1.8,100,2400));
  }
  // Prevailing westerly winds lose moisture over ridges and recover gradually.
  for(let y=0;y<ny;y++) {
    let barrier=0;
    for(let x=0;x<nx;x++) {
      const i=y*nx+x;
      if(!land[i])barrier=0;
      rainfall[i]=round(clamp(rainfall[i]-Math.max(0,barrier-elevation[i])*.45,100,2400));
      barrier=Math.max(elevation[i],barrier*.93);
    }
  }
  const drainage=drainTerrain(elevation,land,nx,ny),flow=land.map((v,i)=>v*rainfall[i]/1000);
  for(const i of [...drainage.order].reverse()) if(drainage.downstream[i]>=0) flow[drainage.downstream[i]]+=flow[i];
  const lake=land.map((v,i)=>Number(v&&drainage.filled[i]-elevation[i]>35));
  const riverThreshold=Math.max(12,land.reduce((a,b)=>a+b,0)/100);
  const river=land.map((v,i)=>Number(v&&flow[i]>riverThreshold));
  const types=options.biomes===false?[]:land.map((v,i)=>{
    if(!v||lake[i])return 'water';
    const x=i%nx,y=Math.floor(i/nx);
    let wet=false;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<nx&&y+dy>=0&&y+dy<ny){const j=i+dy*nx+dx;if(lake[j]||river[j])wet=true;}
    if(temperature[i]<-4)return 'snow';if(temperature[i]<3)return 'tundra';
    if(elevation[i]>1500)return 'alpine';if(wet&&elevation[i]<650)return 'wetland';
    if(rainfall[i]<400&&temperature[i]>10&&!wet)return 'desert';
    return rainfall[i]>850||wet?'forest':'grassland';
  });
  const geography={},biomes={};
  for(const type of ['lake','mountain']) for(const item of regions(type==='lake'?lake:land.map((v,i)=>v&&elevation[i]>1200),nx,ny,step,left,top,type,seed)) geography[item.id]=item;
  for(const item of Object.values(geography))if(item.type==='lake') {
    let lowest=-1;
    for(let i=0;i<n;i++)if(lake[i]&&containsPolygon(item.points,...point(i))&&!item.holes.some(h=>containsPolygon(h,...point(i)))&&(lowest<0||drainage.filled[i]<drainage.filled[lowest]))lowest=i;
    if(lowest>=0) {item.outletCell=drainage.downstream[lowest];item.surfaceLevel=round(drainage.filled[lowest]);}
  }
  // Emit river reaches up to junctions; every reach follows the drainage graph.
  const incoming=new Array(n).fill(0);
  for(let i=0;i<n;i++)if(river[i]&&drainage.downstream[i]>=0&&river[drainage.downstream[i]])incoming[drainage.downstream[i]]++;
  for(let i=0;i<n;i++)if(river[i]&&incoming[i]!==1) {
    const cells=[i];let j=i;
    do {j=drainage.downstream[j];if(j<0)break;cells.push(j);}while(river[j]&&incoming[j]===1);
    if(cells.length<2)continue;
    const id=`natural-river-${i}`;
    geography[id]={id,type:'river',points:cells.map(point),width:step*clamp(Math.sqrt(flow[i])*.045,.12,.6),cells,editState:'generated',protected:false,provenance:{kind:'generator',seed,generatorVersion:'natural-1'}};
  }
  if(options.biomes!==false)for(const type of Object.keys(BIOME_COLORS)) for(const item of regions(types.map(t=>t===type),nx,ny,step,left,top,type,seed)) biomes[item.id]={...item,priority:0};
  if(world.terrainHeightmap)for(const item of [...Object.values(geography),...Object.values(biomes)])item.provenance.generatorVersion='natural-azgaar-heightmap-1';
  return {geography,biomes:prepareBiomes(biomes,step),fields:{version:1,seed,nx,ny,step,x:left,y:top,land,elevation,temperature,rainfall,filled:drainage.filled.map(round),downstream:drainage.downstream}};
}

export function naturalSvg(world) {
  const path=(points,closed=true)=>'M'+points.map(p=>p.map(round).join(' ')).join('L')+(closed?'Z':'');
  const curved=(points,closed=false)=>{
    const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2].map(round).join(' ');
    if(points.length<3)return path(points,closed);
    let d=closed?`M${midpoint(points.at(-1),points[0])}`:`M${points[0].map(round).join(' ')}`;
    for(let i=closed?0:1;i<(closed?points.length:points.length-1);i++)d+=`Q${points[i].map(round).join(' ')} ${midpoint(points[i],points[(i+1)%points.length])}`;
    return d+(closed?'Z':`T${points.at(-1).map(round).join(' ')}`);
  };
  const polygon=item=>[path(item.points),...(item.holes||[]).map(r=>path(r))].join('');
  const step=world.fields?.step||10,biomes=world.showBiomes===false?[]:Object.values(displayedBiomes(world)).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  let hash=2166136261;for(const c of JSON.stringify([world.seed,world.fields?.seed,biomes]))hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const filter=`biome-blend-${(hash>>>0).toString(36)}`;
  const fills=biomes.filter(item=>item.type!=='forest').map(item=>`<path d="${polygon(item)}" fill="${BIOME_COLORS[item.type]||BIOME_COLORS.grassland}" fill-rule="evenodd"/>`).join('');
  let svg=`<defs><filter id="${filter}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${round(step*.65)}"/></filter></defs>${fills}<g filter="url(#${filter})">${fills}</g>`;
  svg+=forestSvg(biomes.filter(item=>item.type==='forest'),{maxAngle:world.forestStyle?.maxAngle??60},world.seed);
  const f=world.fields;
  if(f) {
    const random=seedStream(f.seed,'map-symbols');
    // Small engraved-style symbols follow the fields, not political regions.
    for(let i=0;i<850;i++) {
      const gx=Math.floor(random()*f.nx),gy=Math.floor(random()*f.ny),cell=gy*f.nx+gx;
      if(!f.land[cell])continue;
      const x=round(f.x+(gx+(random()-.5)*.5)*step),y=round(f.y+(gy+(random()-.5)*.5)*step),s=step*.65;
      if(Object.values(world.geography).some(g=>g.type==='lake'&&containsPolygon(g.points,x,y)))continue;
      const biome=[...biomes].reverse().find(b=>containsPolygon(b.points,x,y)&&!(b.holes||[]).some(h=>containsPolygon(h,x,y)))?.type;
      if(world.showPhysical!==false&&f.elevation[cell]>1200&&i%2===0) {const m=s*2;svg+=`<path d="M${round(x-m)} ${round(y+m*.4)}L${x} ${round(y-m)}L${round(x+m)} ${round(y+m*.4)}L${round(x+m*.15)} ${round(y+m*.05)}L${round(x-m*.1)} ${round(y-m*.5)}L${round(x-m*.3)} ${round(y+m*.3)}Z" fill="#d6d4b8" stroke="#666d57" stroke-width="${round(step*.085)}" stroke-linejoin="round"/>`;}
      else if(biome==='wetland')svg+=`<path d="M${round(x-s*.5)} ${y}h${round(s)}M${x} ${y}v${round(-s*.5)}m0 ${round(s*.35)}l${round(s*.2)} ${round(-s*.4)}" stroke="#5c785d" fill="none" stroke-width="${round(step*.06)}" opacity=".65"/>`;
    }
  }
  if(world.showPhysical!==false)for(const item of Object.values(world.geography))if(item.type==='river')svg+=`<path d="${curved(simplifyLine(item.points,step*.75))}" fill="none" stroke="#6b9aab" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(world.showPhysical!==false)for(const item of Object.values(world.geography))if(item.type==='lake')svg+=`<path d="${[item.points,...(item.holes||[])].map(r=>curved(simplifyRing(r,step*.65),true)).join('')}" fill="#8babb2" fill-rule="evenodd" stroke="#658792" stroke-width="1"/>`;
  return svg;
}
