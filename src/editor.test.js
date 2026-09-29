import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, createPreview, mergeGeneratedLayer } from './editor.js';
import { validateAtlas, previewAtlasUpgrade, serializeAtlas } from './atlas.js';
import { addVillageExample, planSettlement, applySettlement } from './campaign.js';
import { generateTownBase } from './town-generator.js';

function fixture() {
  const atlas={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const villageId=addVillageExample(atlas);
  return {atlas:previewAtlasUpgrade(atlas).atlas,villageId};
}

test('history groups typing, preserves complete data and branches after undo',()=>{
  const {atlas,villageId}=fixture(), before=structuredClone(atlas), history=createHistory(atlas);
  const house=atlas.places[atlas.boards[villageId].placeIds[0]];
  house.notes='A'; history.record(atlas,{mergeKey:'notes'});
  house.notes='An important discovery'; history.record(atlas,{mergeKey:'notes'});
  assert.equal(house.editState,'manually-edited'); assert.equal(house.protected,true);
  assert.deepEqual(history.undo().atlas,before); assert.equal(history.canUndo,false);
  const restored=history.redo().atlas; assert.deepEqual(restored,atlas);
  history.breakGroup(); house.x+=20; history.record(atlas);
  assert.equal(house.editState,'manually-moved'); assert.equal(house.keepPlace,true);
  assert.deepEqual(history.undo().atlas,restored);
  const branch=structuredClone(restored); branch.places[house.id].name='Different inn';
  history.record(branch); assert.equal(history.canRedo,false);
  assert.equal(history.record(branch),false);
  assert.doesNotThrow(()=>serializeAtlas(branch));
});

test('regeneration preview cancels without mutations and applies exactly once as one undoable command',()=>{
  const {atlas,villageId}=fixture(), before=structuredClone(atlas), history=createHistory(atlas);
  const mutate=draft=>applySettlement(draft.boards[villageId],draft.places,planSettlement(draft.boards[villageId],draft.places,'new-seed','small'));
  const cancelled=createPreview(atlas,mutate,validateAtlas); cancelled.cancel();
  assert.throws(()=>cancelled.apply(atlas),/closed/); assert.deepEqual(atlas,before);
  const preview=createPreview(atlas,mutate,validateAtlas), expected=structuredClone(preview.candidate);
  preview.candidate.sessions.fake={}; // Exposed preview copy cannot alter the commit.
  const applied=preview.apply(atlas); assert.deepEqual(applied,expected);
  assert.throws(()=>preview.apply(atlas),/closed/);
  history.record(applied,{manual:false,label:'Generate village'});
  assert.deepEqual(history.undo().atlas,before); assert.deepEqual(history.redo().atlas,applied);
  for (const [id,place] of Object.entries(before.places)) {
    assert.deepEqual({...applied.places[id],baseFootprintIndex:place.baseFootprintIndex}, {...place,baseFootprintIndex:place.baseFootprintIndex});
    if (place.baseFootprintIndex != null) assert.deepEqual(
      applied.boards[place.boardId].baseMap.layers.buildings[applied.places[id].baseFootprintIndex],
      before.boards[place.boardId].baseMap.layers.buildings[place.baseFootprintIndex]);
  }
});

test('obsolete and invalid previews cannot overwrite campaign edits',()=>{
  const {atlas}=fixture();
  const preview=createPreview(atlas,draft=>draft.boards.w.worldSeed='next',validateAtlas);
  atlas.sessions.session1={notes:'New fact'};
  assert.throws(()=>preview.apply(atlas),/atlas changed/);
  const before=structuredClone(atlas);
  assert.throws(()=>createPreview(atlas,draft=>draft.schemaVersion=100,validateAtlas));
  assert.deepEqual(atlas,before);
});

test('generated layer merges retain protected and manual overrides, replace ordinary generated content',()=>{
  const existing={manual:{id:'manual',editState:'manually-edited'},locked:{id:'locked',editState:'generated',protected:true},old:{id:'old',editState:'generated'}};
  const generated={manual:{id:'manual',points:[]},fresh:{id:'fresh',editState:'generated'}};
  const merged=mergeGeneratedLayer(existing,generated);
  assert.deepEqual(merged.manual,existing.manual); assert.deepEqual(merged.locked,existing.locked);
  assert.equal(merged.old,undefined); assert.deepEqual(merged.fresh,generated.fresh);
  merged.manual.id='changed'; assert.equal(existing.manual.id,'manual');
});

test('decoration seeds do not move settlement geography or buildings',()=>{
  for (const kind of ['town','village']) {
    const first=generateTownBase(kind,'layout','standard',[],{decorationSeed:'trees-a'});
    const second=generateTownBase(kind,'layout','standard',[],{decorationSeed:'trees-b'});
    assert.notDeepEqual(first.layers.trees,second.layers.trees);
    for (const key of Object.keys(first.layers).filter(k=>k!=='trees')) assert.deepEqual(first.layers[key],second.layers[key],`${kind} ${key}`);
    assert.deepEqual(first,generateTownBase(kind,'layout','standard',[],{decorationSeed:'trees-a'}));
  }
});

test('history limits and atlas replacement stay reversible within budget',()=>{
  const history=createHistory({value:0},{limit:2});
  for(let value=1;value<=3;value++) history.record({value});
  assert.equal(history.undo().atlas.value,2); assert.equal(history.undo().atlas.value,1);
  assert.equal(history.undo(),null);
  const tiny=createHistory({value:0},{maxBytes:1}); tiny.record({value:1}); assert.equal(tiny.canUndo,false);
});
