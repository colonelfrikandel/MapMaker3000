import { generateTownBase } from './town-generator.js';
import { overlaps } from './village-generator.js';
import { cardSize } from './geometry.js';
import { GEOGRAPHY_LAYERS, VILLAGE_TYPES, geographyFor, clearOfGeography, nearestOnSegment, polygonDistance, polygonRoadDistance } from './settlement-geography.js';

export function villageType(base) {
  return VILLAGE_TYPES.includes(base?.layout) ? base.layout : 'river';
}
function footprint(place,board) {
  const [w,h]=cardSize(place.type),x=place.x+w/2,y=place.y+h/2;
  return board.baseMap?.layers.buildings[place.baseFootprintIndex] || [[x-15,y-12],[x+15,y-12],[x+15,y+12],[x-15,y+12]];
}
function center(polygon) { return polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]); }

function planVillage(board,places,seed,size,options) {
  const items=board.placeIds.map(id=>places[id]).filter(Boolean);
  const kept=items.filter(p=>p.keepPlace!==false).map(p=>({place:p,polygon:footprint(p,board)}));
  const houses=kept.filter(a=>a.place.type==='house');
  const keepGeography=options.keepGeography ?? board.keepGeography ?? true;
  const type=options.type || villageType(board.baseMap);
  if(!VILLAGE_TYPES.includes(type)) throw new Error('Choose a supported village type.');
  if(keepGeography && board.baseMap && type!==villageType(board.baseMap)) throw new Error('Uncheck Keep established geography to change the village type.');
  let geography;
  if(keepGeography && board.baseMap) {
    geography={type,layers:Object.fromEntries(GEOGRAPHY_LAYERS.map(key=>[key,structuredClone(board.baseMap.layers[key])]))};
  } else {
    // Try deterministic alternatives around campaign anchors. If no fit exists,
    // return a reviewable conflict instead of flooding or moving a kept place.
    for(let attempt=0;attempt<32;attempt++) {
      const candidate=geographyFor(type,`${seed.trim()}:${attempt}`);
      if(!kept.every(a=>clearOfGeography(a.polygon,candidate.layers))) continue;
      let connected=true;
      for(const anchor of houses) {
        if(polygonRoadDistance(anchor.polygon,candidate.layers.roads)<45) continue;
        const c=center(anchor.polygon),choices=[];
        for(const road of candidate.layers.roads) for(let i=1;i<road.points.length;i++) {
          const p=nearestOnSegment(c,road.points[i-1],road.points[i]);choices.push({p,d:Math.hypot(c[0]-p[0],c[1]-p[1])});
        }
        let access;
        for(const {p,d} of choices.sort((a,b)=>a.d-b.d)) {
          // End at the lot boundary, outside the building's roof.
          const radius=Math.max(...anchor.polygon.map(v=>Math.hypot(v[0]-c[0],v[1]-c[1])))+7;
          const end=[c[0]+(p[0]-c[0])*radius/d,c[1]+(p[1]-c[1])*radius/d];
          const corridor=[p,end];
          if(candidate.layers.water.some(w=>polygonDistance(corridor,w)<8) || kept.some(a=>polygonDistance(corridor,a.polygon)<4)) continue;
          access={points:[p,end],width:6};break;
        }
        if(!access) {connected=false;break;}
        candidate.layers.roads.push(access);
      }
      if(connected) {geography=candidate;break;}
    }
    if(!geography) throw new Error('This geography cannot fit around the kept places. Try another seed, keep the current geography, or uncheck Keep this place for a location that may move.');
  }
  const base=generateTownBase('village',seed,size,houses.map(a=>a.polygon),{geography,avoid:kept.filter(a=>a.place.type!=='house').map(a=>a.polygon)});
  const indices=Object.fromEntries(houses.map((a,i)=>[a.place.id,i])),positions={};
  const available=base.layers.buildings.map((polygon,index)=>({polygon,index})).slice(houses.length);
  for(const item of items.filter(p=>p.keepPlace===false)) {
    if(item.type==='house') {
      if(!available.length) throw new Error('There are more named houses than available plots. Choose a larger village.');
      const current=[item.x+76,item.y+49];
      available.sort((a,b)=>Math.hypot(...center(a.polygon).map((v,i)=>v-current[i]))-Math.hypot(...center(b.polygon).map((v,i)=>v-current[i])));
      const chosen=available.shift(),[x,y]=center(chosen.polygon);
      indices[item.id]=chosen.index;positions[item.id]={x:x-76,y:y-49};
    } else {
      const [x,y]=center(base.layers.squares[0] || [[505,315]]),[w,h]=cardSize(item.type);
      positions[item.id]={x:x-w/2,y:y-h/2};
    }
  }
  return {base,indices,positions,keepGeography,keptIds:kept.map(a=>a.place.id)};
}

// Build previews without mutating campaign facts. Apply only changes the scenery
// and footprint indices; names, positions, events and child boards remain intact.
export function planSettlement(board, places, seed, size, options = {}) {
  if(board.kind==='village') return planVillage(board,places,seed,size,options);
  const anchors=board.placeIds.map(id=>places[id]).filter(p=>p?.type==='house').map(place=>{
    const polygon=board.baseMap?.layers.buildings[place.baseFootprintIndex];
    const [w,h]=cardSize('house'),x=place.x+w/2,y=place.y+h/2;
    return {placeId:place.id,polygon:polygon || [[x-15,y-12],[x+15,y-12],[x+15,y+12],[x-15,y+12]]};
  });
  // Existing geography is a campaign fact too: retain roads, river and public spaces.
  const base=generateTownBase(board.kind,seed,size);
  if (board.baseMap) for (const key of ['water','rivers','roads','planks','squares','greens','walls','districts']) base.layers[key]=structuredClone(board.baseMap.layers[key]);
  // Keep a generous corridor around the saved road network when changing plots.
  function obstructsRoad(polygon) {
    return base.layers.roads.some(road=>road.points.slice(1).some(([bx,by],i)=>{
      const [ax,ay]=road.points[i],dx=bx-ax,dy=by-ay;
      return polygon.some(([x,y])=>{
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
        return Math.hypot(x-ax-t*dx,y-ay-t*dy)<road.width/2+4;
      });
    }));
  }
  base.layers.buildings=base.layers.buildings.filter(p=>!anchors.some(a=>overlaps(p,a.polygon)) && !obstructsRoad(p));
  base.layers.fields=base.layers.fields.filter(p=>!anchors.some(a=>overlaps(p,a.polygon)));
  base.layers.trees=base.layers.trees.filter(([x,y])=>!anchors.some(a=>overlaps([[x-6,y-6],[x+6,y+6]],a.polygon)));
  const indices={};
  for (const anchor of anchors) { indices[anchor.placeId]=base.layers.buildings.length; base.layers.buildings.push(structuredClone(anchor.polygon)); }
  return {base,indices};
}
export function applySettlement(board,places,plan) {
  board.baseMap=plan.base;
  for (const [id,index] of Object.entries(plan.indices)) places[id].baseFootprintIndex=index;
  for (const [id,position] of Object.entries(plan.positions || {})) Object.assign(places[id],position);
  if(plan.keepGeography!=null) board.keepGeography=plan.keepGeography;
}

export function addCampaignEvent(place,title,detail='',session='') {
  if (!title.trim()) throw new Error('Give the event a title');
  const event={id:crypto.randomUUID(),title:title.trim().slice(0,120),detail:detail.trim(),session:session.trim().slice(0,80),provenance:{kind:'manual',sessionRefs:[]}};
  (place.events ||= []).push(event);
  return event;
}

export function addVillageExample(atlas) {
  const existing=Object.values(atlas.boards).find(b=>b.example==='brackenford');
  if (existing) return existing.id;
  const create=(parent,type,name,x,y,description='')=>{
    const id=crypto.randomUUID(),childId=crypto.randomUUID();
    const item={id,boardId:parent.id,type,name,x,y,description,notes:'',childBoardId:childId,provenance:{kind:'example',sessionRefs:[]}};
    const child={id:childId,name,kind:type,parentPlaceId:id,placeIds:[]};
    parent.placeIds.push(id);atlas.places[id]=item;atlas.boards[childId]=child;
    return {item,board:child};
  };
  const root=atlas.boards[atlas.rootBoardId];
  let realm=Object.values(atlas.places).find(p=>p.boardId===root.id && p.type==='continent' && atlas.boards[p.childBoardId]);
  if (!realm) { realm=create(root,'continent','The Riverlands',180,180).item; realm.biome='plains'; realm.island=false; }
  const region=create(atlas.boards[realm.childBoardId],'province','The Bracken Valley',380,250,'A river valley of meadows, old roads and scattered woodland.');
  const village=create(region.board,'village','Brackenford',430,240,'A farming village built around an old stone bridge. The Broken Oar offers shelter beside the crossing.');
  region.board.countrysideVillageId=village.item.id;
  village.board.example='brackenford';
  village.board.baseMap=generateTownBase('village','Brackenford','standard');
  const bridge=village.board.baseMap.layers.planks[0].points[0];
  const candidates=village.board.baseMap.layers.buildings.map((p,index)=>({p,index,c:center(p)})).filter(a=>a.c[0]<bridge[0]);
  candidates.sort((a,b)=>Math.hypot(a.c[0]-bridge[0]+60,a.c[1]-bridge[1]+35)-Math.hypot(b.c[0]-bridge[0]+60,b.c[1]-bridge[1]+35));
  const chosen=candidates[0];
  const tavern=create(village.board,'house','The Broken Oar',chosen.c[0]-76,chosen.c[1]-49,'A riverside tavern just west of the old bridge, with a common room, kitchen, guest room and cellar.');
  tavern.item.baseFootprintIndex=chosen.index;
  tavern.item.keepPlace=true;
  tavern.item.notes='Example location — replace these details with your campaign.';
  for (const [name,x,y,description] of [
    ['Common room',120,100,'A stone hearth, long tables, and a noticeboard for travelers.'],
    ['Kitchen',550,100,'A warm kitchen opening onto the common room.'],
    ['Guest room',120,340,'A quiet room overlooking the river.'],
    ['Cellar',550,340,'A cool storeroom beneath the tavern. What is hidden here is up to your campaign.'],
  ]) {
    const id=crypto.randomUUID();
    atlas.places[id]={id,boardId:tavern.board.id,type:'room',name,x,y,description,notes:'',childBoardId:null,provenance:{kind:'example',sessionRefs:[]}};
    tavern.board.placeIds.push(id);
  }
  return village.board.id;
}
