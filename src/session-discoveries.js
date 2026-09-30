import { validateAtlas, previewAtlasUpgrade } from './atlas.js';
import { newBiome } from './biome-editor.js';
import { circleAnchors } from './biome-curves.js';
import { cardSize } from './geometry.js';

export const DISCOVERY_TYPES={place:['village','town','landmark'],biome:['forest','desert','snow','wetland','grassland','tundra','alpine'],route:['road','trail','river','sea','passage'],event:['event']};
const words={village:'village',dorp:'village',town:'town',city:'town',stad:'town',ruin:'landmark',ruins:'landmark',ruïne:'landmark',tower:'landmark',toren:'landmark',cave:'landmark',grot:'landmark'};
const biomes={forest:'forest',woods:'forest',bos:'forest',woud:'forest',desert:'desert',woestijn:'desert',swamp:'wetland',marsh:'wetland',moeras:'wetland',grassland:'grassland',grasland:'grassland',tundra:'tundra',toendra:'tundra',snow:'snow',sneeuw:'snow'};
export function sessionSource(session){return [session.notes,session.transcript,session.discoveries].filter(Boolean).join('\n');}
export function discoveryDraft(kind,source='',id=crypto.randomUUID()) {
  return {id,kind,type:DISCOVERY_TYPES[kind][0],name:'',detail:source,source,status:'pending',x:null,y:null,radius:60,from:'',to:'',target:''};
}
export function proposeDiscoveries(atlas,session) {
  const output=[],seen=new Set(),known=new Set(Object.values(atlas.places).map(p=>p.name.toLocaleLowerCase()));
  const add=(kind,type,name,source)=>{const key=kind+':'+name.toLocaleLowerCase();if(seen.has(key)||output.length>=100)return;seen.add(key);output.push({...discoveryDraft(kind,source,`proposal-${output.length}`),type,name});};
  for(const clause of sessionSource(session).split(/[.!?;\n]+/).map(s=>s.trim()).filter(Boolean)) {
    // Conservative local rules: quoted names or capitalized names after a place type.
    // Uncertainty and negative statements are omitted rather than treated as facts.
    if(/\b(no|not|never|without|isn't|wasn't|geen|niet|nooit|zonder|maybe|perhaps|misschien|rumou?r|gerucht)\b/i.test(clause))continue;
    const pattern=/\b([Vv]illage|[Dd]orp|[Tt]own|[Cc]ity|[Ss]tad|[Rr]uins?|[Rr]uïne|[Tt]ower|[Tt]oren|[Cc]ave|[Gg]rot)\s+(?:(?:called|named|genaamd)\s+)?(?:["“]([^"”]+)["”]|(\p{Lu}[\p{L}\p{N}'’-]*(?:\s+\p{Lu}[\p{L}\p{N}'’-]*){0,3}))/gu;
    for(const match of clause.matchAll(pattern)) {const name=(match[2]||match[3]).trim();if(name.length<=120&&!known.has(name.toLocaleLowerCase()))add('place',words[match[1].toLocaleLowerCase()],name,clause);}
    const tokens=clause.toLocaleLowerCase().match(/[\p{L}]+/gu)||[];
    for(const token of tokens)if(biomes[token])add('biome',biomes[token],token,clause);
    if(/\b(road|trail|path|route|weg|pad|route|verbinding)\b/i.test(clause))add('route',/\b(trail|path|pad)\b/i.test(clause)?'trail':'road',clause.slice(0,120),clause);
    if(/\b(battle|attack|discovered|found|met|fight|gevecht|aanval|ontdekten|vonden|ontmoetten|versloegen)\b/i.test(clause))add('event','event',clause.slice(0,120),clause);
  }
  return output;
}
export function applyDiscoveries(atlas,sessionId,proposals) {
  if(!atlas.sessions[sessionId])throw new Error('Save the session first.');
  if(!Array.isArray(proposals)||proposals.length>100||new Set(proposals.map(p=>p.id)).size!==proposals.length)throw new Error('Invalid discovery review');
  let next=structuredClone(atlas);
  const session=next.sessions[sessionId],root=next.rootBoardId;
  const previous=new Map((session.discoveryReview?.proposals||[]).map(p=>[p.id,p]));
  const entries=structuredClone(proposals);
  const references=new Map(Object.keys(next.places).map(id=>['place:'+id,id]));
  const provenance=p=>({kind:'session-suggestion',sessionId,sourceText:p.source,proposalId:p.id});
  for(const p of entries){
    if(typeof p.id!=='string'||!DISCOVERY_TYPES[p.kind]||!['pending','accepted','rejected','applied'].includes(p.status))throw new Error('Invalid discovery');
    const old=previous.get(p.id);
    if(old?.status==='applied'){Object.assign(p,old);if(p.kind==='place')references.set('proposal:'+p.id,p.resultId);continue;}
    if(p.status==='applied')throw new Error('Discovery has not been applied');
    if(p.status!=='accepted')continue;
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120||typeof p.detail!=='string'||p.detail.length>200000||typeof p.source!=='string'||!DISCOVERY_TYPES[p.kind].includes(p.type))throw new Error('Give every accepted discovery a valid name and type.');
    if(['place','biome'].includes(p.kind)&&(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7))throw new Error('Choose a map position for '+p.name);
    if(p.kind==='place'){
      if(Object.values(next.places).some(place=>place.name.toLocaleLowerCase()===p.name.trim().toLocaleLowerCase()))throw new Error('A place named '+p.name+' already exists. Reject this proposal or give it a distinct name.');
      const id=crypto.randomUUID(),[w,h]=cardSize(p.type);
      next.places[id]={id,boardId:root,type:p.type,name:p.name.trim(),x:p.x-w/2,y:p.y-h/2,description:p.detail,notes:'',childBoardId:null,provenance:provenance(p),protected:true,editState:'manually-edited'};
      next.boards[root].placeIds.push(id);references.set('proposal:'+p.id,id);p.resultId=id;
      session.discoveryPlaceIds=[...new Set([...(session.discoveryPlaceIds||[]),id])];
    }
  }
  for(const p of entries){
    if(p.status!=='accepted')continue;
    const id=p.resultId||crypto.randomUUID();
    if(p.kind==='biome'){
      if(!Number.isFinite(p.radius)||p.radius<5||p.radius>1000)throw new Error('Biome radius must be between 5 and 1000.');
      if(next.schemaVersion===1)next=previewAtlasUpgrade(next).atlas;
      const world=next.worlds[root],priority=1+Math.max(0,...Object.values(world.biomes).map(b=>b.priority||0));
      world.biomes[id]={...newBiome(id,p.type,circleAnchors(p.x,p.y,p.radius),priority),name:p.name,curved:true,boundaryVersion:2,provenance:provenance(p)};
    }
    if(p.kind==='route'){
      const from=references.get(p.from),to=references.get(p.to),a=next.places[from],b=next.places[to];
      if(!a||!b||from===to||a.boardId!==b.boardId)throw new Error('Choose two different places on the same map for '+p.name);
      next.routes[id]={id,boardId:a.boardId,type:p.type,name:p.name,fromPlaceId:from,toPlaceId:to,notes:p.detail,provenance:provenance(p),protected:true,editState:'manually-edited'};
    }
    if(p.kind==='event'){
      const place=next.places[references.get(p.target)];if(!place)throw new Error('Choose a place for the event '+p.name);
      (place.events ||= []).push({id,title:p.name,detail:p.detail,session:session.title||session.name||'',provenance:provenance(p)});
    }
    p.resultId=id;p.status='applied';
  }
  next.sessions[sessionId].discoveryReview={source:sessionSource(next.sessions[sessionId]),proposals:entries};
  return validateAtlas(next);
}
