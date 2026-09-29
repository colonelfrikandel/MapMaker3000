import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestSessionChanges, applySessionSuggestions } from './session-suggestions.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { validateAtlas } from './atlas.js';
import { createPreview } from './editor.js';

function fixture() {
  const a={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'Test',placeIds:['p']}},places:{p:{id:'p',boardId:'w',type:'continent',name:'Test place',x:400,y:250,notes:'Original notes',events:[]}},routes:{},sessions:{}};
  return previewContinent(a,'w','test',DEFAULT_CONTINENT).transaction.apply(a);
}
const input={placeId:'p',source:'The village lies in a forest. The bridge is old.',sessionName:'Session 12',eventTitle:'Arrival',sessionId:'s',eventId:'e',biomeId:'b',acceptedAt:'2026-09-30T12:00:00Z'};
test('suggestions are read-only and ambiguous or negated biome mentions are not mapped',()=>{
  const a=fixture(),before=structuredClone(a);
  assert.deepEqual(suggestSessionChanges(a,'p',input.source).map(s=>s.id),['note','event','biome']);
  for(const text of ['There is no forest here.','The village is not in a swamp.','A forest borders a desert.','We left the forest.'])assert.equal(suggestSessionChanges(a,'p',text).some(s=>s.kind==='biome'),false);
  assert.deepEqual(a,before);
});
test('only accepted choices apply; provenance, circles and campaign identity survive export',()=>{
  const a=fixture(),before=structuredClone(a);
  const notes=applySessionSuggestions(a,{...input,selected:['note']});
  assert.equal(notes.places.p.notes,'Original notes\n\n'+input.source);assert.equal(notes.places.p.events.length,0);assert.equal(Object.keys(notes.worlds.w.biomes).length,0);
  const all=applySessionSuggestions(a,{...input,selected:['note','event','biome']});
  assert.equal(all.places.p.events[0].provenance.sessionId,'s');assert.equal(all.worlds.w.biomes.b.points.length,4);assert.equal(all.worlds.w.biomes.b.protected,true);
  assert.equal(all.sessions.s.sourceText,input.source);assert.equal(all.places.p.id,a.places.p.id);
  assert.deepEqual(validateAtlas(JSON.parse(JSON.stringify(all))),all);assert.deepEqual(a,before);
});
test('cancelled and stale review previews cannot overwrite campaign changes',()=>{
  const a=fixture(),change=draft=>Object.assign(draft,applySessionSuggestions(draft,{...input,selected:['event']}));
  const cancelled=createPreview(a,change,validateAtlas);cancelled.cancel();assert.throws(()=>cancelled.apply(a),/closed/);
  const stale=createPreview(a,change,validateAtlas);a.places.p.notes='New notes';assert.throws(()=>stale.apply(a),/changed/);
  assert.throws(()=>applySessionSuggestions(a,{...input,selected:[]}),/Select/);
});
