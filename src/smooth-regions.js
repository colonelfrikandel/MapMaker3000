import { biomeGeometry } from './biome-curves.js';
import clip from './polygon-ops.js';

const distance=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
export function simplifyLine(points,tolerance) {
  if(points.length<3)return points;
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop();let far=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=distance(points[i],points[a],points[b]);if(d>far){far=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
  return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
export function simplifyRing(points,tolerance) {
  if(points.length<5)return structuredClone(points);
  let far=1;for(let i=2;i<points.length;i++)if(Math.hypot(...points[i].map((v,j)=>v-points[0][j]))>Math.hypot(...points[far].map((v,j)=>v-points[0][j])))far=i;
  const result=[...simplifyLine(points.slice(0,far+1),tolerance).slice(0,-1),...simplifyLine([...points.slice(far),points[0]],tolerance).slice(0,-1)];
  return structuredClone(result.length>=3?result:points);
}
export function smoothRing(points,tolerance) {
  const reduced=simplifyRing(points,tolerance),rounded=[];
  for(let i=0;i<reduced.length;i++) {
    const a=reduced[i],b=reduced[(i+1)%reduced.length];
    rounded.push([a[0]*.8+b[0]*.2,a[1]*.8+b[1]*.2],[a[0]*.2+b[0]*.8,a[1]*.2+b[1]*.8]);
  }
  return simplifyRing(rounded,tolerance*.3);
}
const protectedRegion=r=>r.protected||r.editState==='manually-edited'||r.editState==='manually-moved'||r.editState==='protected';
const ringArea=r=>Math.abs(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
function open(ring) {
  const result=ring.slice(0,-1).map(p=>[...p]);
  for(let pass=0;pass<3;pass++)for(let i=result.length-1;i>=0&&result.length>3;i--) {
    const a=result[(i+result.length-1)%result.length],b=result[i],c=result[(i+1)%result.length];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5||distance(b,a,c)<1e-7)result.splice(i,1);
  }
  return result;
}

// Union equal biome types, then subtract previously allocated regions. This is
// real disjoint geometry, not transparent polygons stacked on top of each other.
export function prepareBiomes(records,step=10,{smoothAll=false,preserveProtected=false,preferId=null}={}) {
  const ordered=Object.values(records).sort((a,b)=>Number(preserveProtected&&protectedRegion(b))-Number(preserveProtected&&protectedRegion(a))||(b.priority??0)-(a.priority??0)||b.id.localeCompare(a.id));
  const groups=new Map();
  for(const r of ordered) {
    const protectedCopy=preserveProtected&&protectedRegion(r);
    const key=protectedCopy?r.id:`${r.type}:${r.priority??0}:${protectedRegion(r)?'manual':'generated'}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  const output={};let occupied=[];
  for(const group of groups.values()) {
    const first=group.find(r=>r.id===preferId)||group[0],keep=preserveProtected&&protectedRegion(first);
    const polygons=group.map(r=>[r.points,...(r.holes||[])].map(ring=>(!keep&&(smoothAll||(!protectedRegion(r)&&r.boundaryVersion!==2))?smoothRing(ring,step*.85):structuredClone(ring))));
    const united=clip.union(...polygons);
    const pieces=(occupied.length&&!keep?clip.difference(united,occupied):united).sort((a,b)=>ringArea(b[0])-ringArea(a[0]));
    if(keep)output[first.id]=structuredClone(first);
    else pieces.forEach((polygon,i)=>{
      if(ringArea(polygon[0])<step*step*.08)return;
      const center=ring=>ring.reduce((sum,p)=>[sum[0]+p[0]/ring.length,sum[1]+p[1]/ring.length],[0,0]);
      const c=center(polygon[0]);let anchor=first,best=Infinity;
      for(let j=0;j<group.length;j++) {
        const q=center(polygons[j][0]),d=Math.hypot(c[0]-q[0],c[1]-q[1]);
        if(d<best){anchor=group[j];best=d;}
      }
      if(pieces.length===1&&group.some(r=>r.id===preferId))anchor=first;
      let id=anchor.id;
      while(output[id])id+='~part';
      output[id]={...structuredClone(anchor),id,points:open(polygon[0]),holes:polygon.slice(1).map(open),boundaryVersion:2};
    });
    occupied=occupied.length?clip.union(occupied,united):united;
  }
  return output;
}

const cache=new WeakMap();
export function displayedBiomes(world) {
  if(!cache.has(world.biomes)&&Object.values(world.biomes).some(r=>r.curved))cache.set(world.biomes,prepareBiomes(Object.fromEntries(Object.entries(world.biomes).map(([id,r])=>[id,biomeGeometry(r)])),world.fields?.step||10));
  if(!cache.has(world.biomes))cache.set(world.biomes,Object.values(world.biomes).every(r=>r.boundaryVersion===2)?world.biomes:prepareBiomes(world.biomes,world.fields?.step||10));
  return cache.get(world.biomes);
}

// Screen-space spacing keeps handles readable. Zooming reveals finer vertices.
export function visibleHandles(rings,scale,selected=null) {
  const result=[];let last=null;
  rings.forEach((ring,ri)=>{
    last=null;ring.forEach((p,index)=>{
      const chosen=selected?.ring===ri&&selected.index===index;
      if(chosen||!last||Math.hypot(p[0]-last[0],p[1]-last[1])*scale>=26){result.push({ring:ri,index,point:p});last=p;}
    });
  });
  if(result.length<=48)return result;
  return result.filter((r,i)=>i%Math.ceil(result.length/48)===0||(selected?.ring===r.ring&&selected.index===r.index));
}
