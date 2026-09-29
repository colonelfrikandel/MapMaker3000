import { biomeGeometry } from './biome-curves.js';
import { containsPolygon } from './natural-geography.js';

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
function intersects(a,b,c,d) {
  return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function ringsCross(a,b) {return a.some((p,i)=>b.some((q,j)=>intersects(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));}
export function validateBiomePolygon(region) {
  const rings=[region.points,...(region.holes||[])];
  for(const points of rings) {
    if(!Array.isArray(points)||points.length<3||points.length>20000||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new Error('A region needs at least three finite points.');
    let area=0;
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)throw new Error('Two neighboring points overlap.');
      const previous=points[(i+points.length-1)%points.length];
      if(on(previous,a,b)||on(a,b,previous))throw new Error('A polygon edge folds back on itself.');
      for(let j=i+2;j<points.length;j++) {
        if(i===0&&j===points.length-1)continue;
        if(intersects(a,b,points[j],points[(j+1)%points.length]))throw new Error('Polygon edges cannot cross or touch.');
      }
    }
    if(Math.abs(area)<1e-6)throw new Error('A region must enclose an area.');
  }
  for(let i=1;i<rings.length;i++) {
    if(!containsPolygon(rings[0],...rings[i][0])||ringsCross(rings[0],rings[i]))throw new Error('A hole must stay inside its region.');
    for(let j=1;j<i;j++)if(ringsCross(rings[i],rings[j])||containsPolygon(rings[i],...rings[j][0])||containsPolygon(rings[j],...rings[i][0]))throw new Error('Region holes cannot overlap.');
  }
  if(region.curved)validateBiomePolygon({...biomeGeometry(region),curved:false});
  return region;
}
export function biomeAtPoint(biomes,x,y) {
  return Object.values(biomes).sort((a,b)=>(b.priority??0)-(a.priority??0)||b.id.localeCompare(a.id)).find(r=>{const g=biomeGeometry(r);return containsPolygon(g.points,x,y)&&!(g.holes||[]).some(h=>containsPolygon(h,x,y));}) || null;
}
export function editBiome(region,operation) {
  const next=structuredClone(region),rings=[next.points,...(next.holes||[])];
  const points=rings[operation.ring||0];
  switch(operation.kind) {
    case 'vertex': points[operation.index]=operation.point;break;
    case 'insert': {const a=points[operation.index],b=points[(operation.index+1)%points.length];points.splice(operation.index+1,0,operation.point||[(a[0]+b[0])/2,(a[1]+b[1])/2]);break;}
    case 'delete-vertex': points.splice(operation.index,1);break;
    case 'move': for(const ring of rings)for(const p of ring){p[0]+=operation.dx;p[1]+=operation.dy;}break;
    case 'properties': if(typeof operation.type!=='string'||!Number.isFinite(operation.priority))throw new Error('Choose a biome and a finite priority.');next.type=operation.type;next.priority=operation.priority;break;
    default:throw new Error('Unknown biome edit');
  }
  validateBiomePolygon(next);next.editState='manually-edited';next.protected=true;return next;
}
export function newBiome(id,type,points,priority=1) {
  if(typeof type!=='string'||!type||!Number.isFinite(priority))throw new Error('Choose a biome and finite priority.');
  return validateBiomePolygon({id,type,points:structuredClone(points),holes:[],priority,editState:'manually-edited',protected:true,provenance:{kind:'manual'}});
}
export function removeBiome(world,id) {
  if(!world.biomes[id])return;
  world.biomeDeletions=[...new Set([...(world.biomeDeletions||[]),id,...(world.biomes[id].mergedFrom||[])])];delete world.biomes[id];
}
