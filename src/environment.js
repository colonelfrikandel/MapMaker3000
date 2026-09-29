import { buildLayout } from './geometry.js';
import { biomeAtPoint } from './biome-editor.js';
import { displayedBiomes } from './smooth-regions.js';
import { containsPolygon } from './natural-geography.js';

const resources={forest:['timber'],grassland:['pasture'],wetland:['reeds'],desert:['stone'],snow:[],tundra:[],alpine:['stone']};
const inside=(r,x,y)=>containsPolygon(r.points,x,y)&&!(r.holes||[]).some(h=>containsPolygon(h,x,y));
function lineDistance(points,x,y,closed=false) {
  let best=Infinity;
  for(let i=0;i<points.length-(closed?0:1);i++) {
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
  }
  return best;
}

// Derived from the same nested transforms as the map; never copied onto places.
export function samplePlaceEnvironment(atlas,placeId,layout=buildLayout(atlas)) {
  const rect=layout.places.get(placeId);
  if(!rect)return null;
  let board=atlas.boards[atlas.places[placeId].boardId];const seen=new Set();
  while(board&&board.kind!=='world') {
    if(seen.has(board.id))return null;seen.add(board.id);
    board=atlas.boards[atlas.places[board.parentPlaceId]?.boardId];
  }
  const world=atlas.worlds?.[board?.id],transform=layout.boards.get(board?.id);
  if(world?.mode!=='independent'||!transform)return null;
  const x=(rect.x+rect.width/2-transform.x)/transform.scale,y=(rect.y+rect.height/2-transform.y)/transform.scale;
  const radius=Math.max(2,Math.min(40,rect.width/transform.scale/2));
  const geography=Object.values(world.geography),coasts=geography.filter(g=>g.type==='coastline');
  const land=coasts.reduce((count,r)=>count+Number(inside(r,x,y)),0)%2===1;
  const lake=geography.some(g=>g.type==='lake'&&inside(g,x,y));
  const surface=land&&!lake?'land':'water';
  const biome=surface==='land'?biomeAtPoint(displayedBiomes(world),x,y):null;
  const coastDistance=Math.min(...coasts.map(g=>lineDistance(g.points,x,y,true)));
  const freshwater=geography.some(g=>['lake','river'].includes(g.type)&&(g.type==='lake'&&inside(g,x,y)||lineDistance(g.points,x,y,g.type==='lake')<=radius));
  let nearbyRoad=false,riverRoute=false;
  for(const [id,line] of layout.routes) {
    const route=atlas.routes[id];
    const points=[[line.x1,line.y1],[line.x2,line.y2]].map(p=>[(p[0]-transform.x)/transform.scale,(p[1]-transform.y)/transform.scale]);
    if(lineDistance(points,x,y)<=radius){if(['road','trail','passage'].includes(route.type))nearbyRoad=true;if(route.type==='river')riverRoute=true;}
  }
  const f=world.fields;
  const gx=f?Math.round((x-f.x)/f.step):-1,gy=f?Math.round((y-f.y)/f.step):-1;
  const cell=f&&gx>=0&&gy>=0&&gx<f.nx&&gy<f.ny?gy*f.nx+gx:-1;
  const value=key=>cell>=0&&Number.isFinite(f[key]?.[cell])?f[key][cell]:null;
  return {worldBoardId:board.id,x,y,surface,biome:biome?.type||null,biomeId:biome?.id||null,
    elevation:value('elevation'),temperature:value('temperature'),rainfall:value('rainfall'),
    nearbyWater:surface==='water'||coastDistance<=radius||freshwater||riverRoute,nearbyRoad,
    resources:[...(surface==='land'?resources[biome?.type]||[]:[]),...(freshwater||riverRoute?['freshwater']:[])]};
}

export function environmentDescription(context) {
  if(!context)return 'Environment becomes available after generating a landmass.';
  const label=context.surface==='water'?'Water':context.biome==='wetland'?'Swamp':context.biome?context.biome[0].toUpperCase()+context.biome.slice(1):'Plain land (no biome placed)';
  return [label,context.nearbyWater?'Near water':null,context.nearbyRoad?'Near a road':null,
    context.elevation!=null?`Elevation ${Math.round(context.elevation)} m`:null,
    context.resources.length?`Potential resources: ${context.resources.join(', ')}`:null].filter(Boolean).join(' · ');
}
