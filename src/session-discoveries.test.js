import test from 'node:test';
import assert from 'node:assert/strict';
import { blankAtlas } from './blank-atlas.js';
import { saveSessionRecord } from './session-records.js';
import { proposeDiscoveries, discoveryDraft, applyDiscoveries } from './session-discoveries.js';
import { validateAtlas, serializeAtlas } from './atlas.js';
import { createHistory } from './editor.js';
import { cardSize } from './geometry.js';

function fixture(){return saveSessionRecord(blankAtlas('world'),{id:'s',title:'Arrival',date:'2026-09-30',startPlaceId:null,visitedPlaceIds:[],discoveryPlaceIds:[],notes:'',transcript:'',discoveries:''});}
function proposal(kind,id,patch={}){return {...discoveryDraft(kind,'Source passage',id),name:id,status:'accepted',...patch};}
const place=(id,x=30)=>proposal('place',id,{x,y:50});

test('Dutch and English text creates unaccepted proposals with exact source passages',()=>{
  const atlas=fixture(),session={notes:'We reached the village "Oakvale". We followed a road through the forest.',transcript:'We bereikten het dorp "Berkdam". We vonden een grot. Een moeras lag verderop.'};
  const drafts=proposeDiscoveries(atlas,session);
  assert.ok(drafts.some(p=>p.kind==='place'&&p.name==='Oakvale'));
  assert.ok(drafts.some(p=>p.kind==='place'&&p.name==='Berkdam'));
  for(const kind of ['place','biome','route','event'])assert.ok(drafts.some(p=>p.kind===kind));
  assert.ok(drafts.every(p=>p.status==='pending'&&p.x===null&&p.y===null&&p.source));
  assert.equal(drafts.find(p=>p.name==='Oakvale').source,'We reached the village "Oakvale"');
  assert.deepEqual(atlas.places,{});
});

test('negative and uncertain mentions are skipped; duplicate and existing place names are suppressed',()=>{
  let atlas=fixture();atlas=applyDiscoveries(atlas,'s',[place('Oakvale')]);
  const drafts=proposeDiscoveries(atlas,{notes:'There is no forest. Geen moeras. Maybe a village "Unknown". We reached the village "Oakvale". We entered the village "Newford". We left the village "Newford".'});
  assert.deepEqual(drafts.map(p=>p.name),['Newford']);
});

test('accepting places, biome, route and event is atomic, attributed, exportable and undoable',()=>{
  const atlas=fixture(),history=createHistory(atlas),before=structuredClone(atlas);
  const drafts=[place('Oakvale'),place('Berkdam',200),proposal('biome','Forest',{type:'forest',x:80,y:80}),proposal('route','Old road',{from:'proposal:Oakvale',to:'proposal:Berkdam'}),proposal('event','Arrival',{target:'proposal:Oakvale',detail:'Met the mayor.'}),proposal('place','Rejected',{status:'rejected'}),proposal('place','Later',{status:'pending'})];
  const next=applyDiscoveries(atlas,'s',drafts);
  assert.deepEqual(atlas,before);assert.equal(Object.keys(next.places).length,2);
  const oak=Object.values(next.places).find(p=>p.name==='Oakvale');assert.equal(oak.x,30-cardSize('village')[0]/2);
  assert.equal(oak.events[0].detail,'Met the mayor.');assert.equal(oak.events[0].provenance.sessionId,'s');
  assert.equal(Object.values(next.routes)[0].fromPlaceId,oak.id);assert.equal(Object.values(next.worlds.world.biomes)[0].provenance.sourceText,'Source passage');
  assert.equal(next.sessions.s.discoveryPlaceIds.length,2);
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(next))),next);
  history.record(next,{manual:false});assert.deepEqual(history.undo().atlas,before);assert.deepEqual(history.redo().atlas,next);
  assert.deepEqual(applyDiscoveries(next,'s',next.sessions.s.discoveryReview.proposals),next);
});

test('invalid accepted positions and dependencies fail without partially creating discoveries',()=>{
  for(const invalid of [proposal('biome','bad',{x:0,y:0,radius:0}),proposal('place','unpositioned'),proposal('route','missing endpoints'),proposal('event','missing target'),proposal('place','unknown type',{x:0,y:0,type:'realm'})]){
    const atlas=fixture(),before=structuredClone(atlas);assert.throws(()=>applyDiscoveries(atlas,'s',[place('valid'),invalid]));assert.deepEqual(atlas,before);
  }
});

test('saved pending and rejected decisions persist; later acceptance creates only the requested place',()=>{
  const atlas=fixture();const draft=proposal('place','Manual discovery',{status:'pending',detail:'<script>ordinary stored text</script>'});
  const saved=applyDiscoveries(atlas,'s',[draft]);assert.deepEqual(saved.places,{});
  const edited={...saved.sessions.s.discoveryReview.proposals[0],name:'Edited discovery',x:60,y:70,status:'accepted'};
  const next=applyDiscoveries(saved,'s',[edited]);assert.equal(Object.values(next.places)[0].name,'Edited discovery');assert.equal(Object.values(next.places)[0].description,draft.detail);
});

test('duplicate places and forged applied proposals are rejected',()=>{
  const atlas=applyDiscoveries(fixture(),'s',[place('Oakvale')]);
  assert.throws(()=>applyDiscoveries(atlas,'s',[place('other',40),{...place('duplicate'),name:'oakvale'}]),/already exists/);
  assert.throws(()=>applyDiscoveries(fixture(),'s',[{...place('fake'),status:'applied',resultId:'fake'}]),/not been applied/);
});

test('import rejects malformed discovery reviews before the UI can use them',()=>{
  const atlas=applyDiscoveries(fixture(),'s',[proposal('place','Later',{status:'pending'})]);
  for(const patch of [{kind:'unknown'},{name:{}},{x:'3'},{status:'surprise'}]){const next=structuredClone(atlas);Object.assign(next.sessions.s.discoveryReview.proposals[0],patch);assert.throws(()=>validateAtlas(next));}
});
