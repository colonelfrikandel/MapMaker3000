import test from 'node:test';
import assert from 'node:assert/strict';
import { blankAtlas } from './blank-atlas.js';
import { saveSessionRecord } from './session-records.js';
import { validateAtlas, serializeAtlas } from './atlas.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { createHistory } from './editor.js';

const record=()=>({id:'session',title:' First visit ',date:'2026-09-30',startPlaceId:'deleted-place',visitedPlaceIds:['deleted-place'],discoveryPlaceIds:[],notes:'We arrived. We kwamen aan.',transcript:'<script>text only</script>',discoveries:'An old ruin'});

test('session records round trip verbatim, retain missing links, edit without duplicates and undo',()=>{
  const atlas=blankAtlas('world'),history=createHistory(atlas);
  const saved=saveSessionRecord(atlas,record());
  assert.deepEqual(atlas.sessions,{});
  assert.equal(saved.sessions.session.title,'First visit');
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(saved))).sessions,saved.sessions);
  history.record(saved,{manual:false});assert.deepEqual(history.undo().atlas,atlas);assert.deepEqual(history.redo().atlas,saved);
  const edited=saveSessionRecord(saved,{...record(),notes:'Updated'});
  assert.equal(Object.keys(edited.sessions).length,1);assert.equal(edited.sessions.session.notes,'Updated');
});

test('session validation rejects malformed dates and links but preserves older review data',()=>{
  const atlas=blankAtlas('world');atlas.sessions.old={notes:'legacy'};
  assert.deepEqual(validateAtlas(atlas).sessions,atlas.sessions);
  for(const patch of [{date:'2026-02-30'},{title:' '},{visitedPlaceIds:['x','x']},{transcript:42},{recordVersion:2}]) {
    const next=saveSessionRecord(atlas,record());Object.assign(next.sessions.session,patch);
    assert.throws(()=>validateAtlas(next));
  }
});

test('clean world removes named campaign content only on apply and supports undo',()=>{
  const atlas=blankAtlas('world');atlas.boards.world.name='Named realm';
  atlas.places.p={id:'p',boardId:'world',type:'landmark',name:'Premade name',x:0,y:0};atlas.boards.world.placeIds=['p'];
  atlas.sessions.old={notes:'Campaign notes'};
  const before=structuredClone(atlas),history=createHistory(atlas);
  const options={cleanWorld:true,physical:true};
  const preview=previewContinent(atlas,'world','clean',DEFAULT_CONTINENT,options);
  assert.deepEqual(atlas,before);
  const clean=preview.transaction.apply(atlas);
  for(const key of ['places','routes','sessions'])assert.deepEqual(clean[key],{});
  assert.equal(Object.keys(clean.boards).length,1);assert.equal(clean.boards.world.name,'Untitled world');
  assert.deepEqual(clean.worlds.world.biomes,{});assert.deepEqual(clean.worlds.world.territories,{});
  assert.ok(Object.keys(clean.worlds.world.geography).length);
  assert.ok(Object.values(clean.worlds.world.geography).every(item=>!item.name));
  assert.doesNotMatch(serializeAtlas(clean),/Premade name|Named realm|Campaign notes/);
  history.record(clean,{manual:false});assert.deepEqual(history.undo().atlas,before);
  const cancelled=previewContinent(atlas,'world','clean',DEFAULT_CONTINENT,options);cancelled.transaction.cancel();assert.throws(()=>cancelled.transaction.apply(atlas));assert.deepEqual(atlas,before);
  const preserved=previewContinent(atlas,'world','clean',DEFAULT_CONTINENT,{physical:true}).transaction.apply(atlas);
  assert.equal(preserved.places.p.name,'Premade name');assert.deepEqual(preserved.sessions,atlas.sessions);
});
