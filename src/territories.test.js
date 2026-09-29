import test from 'node:test';
import assert from 'node:assert/strict';
import { territorySvg,assignTerritory } from './territories.js';
import { editBiome,newBiome } from './biome-editor.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { buildLayout } from './geometry.js';
import { addVillageExample } from './campaign.js';
import { serializeAtlas,validateAtlas } from './atlas.js';
import { createHistory } from './editor.js';

function fixture() {
  const atlas={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  addVillageExample(atlas);
  return previewContinent(atlas,'w','test',DEFAULT_CONTINENT,{natural:true}).transaction.apply(atlas);
}
test('territory changes preserve terrain, ecology, campaign identities and nested positions',()=>{
  const atlas=fixture(),before=structuredClone(atlas),layout=buildLayout(atlas),world=atlas.worlds.w;
  const realm=atlas.boards.w.placeIds[0];
  const region=assignTerritory(newBiome('border','territory',[[0,0],[200,0],[200,200],[0,200]]),realm,atlas,'w');
  world.territories[region.id]=region;
  world.territories.border=editBiome(region,{kind:'vertex',index:1,point:[240,-20]});
  assert.deepEqual(world.geography,before.worlds.w.geography);
  assert.deepEqual(world.biomes,before.worlds.w.biomes);assert.deepEqual(world.fields,before.worlds.w.fields);
  assert.deepEqual(atlas.places,before.places);assert.deepEqual(atlas.boards,before.boards);assert.deepEqual(buildLayout(atlas),layout);
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(atlas))),atlas);
});
test('territories retain identity through generation and support undo plus visibility control',()=>{
  const atlas=fixture(),history=createHistory(atlas),world=atlas.worlds.w,realm=atlas.boards.w.placeIds[0];
  world.territories.border=assignTerritory(newBiome('border','territory',[[0,0],[100,0],[0,100]]),realm,atlas,'w');
  history.record(atlas,{manual:false,label:'Draw territory'});
  assert.deepEqual(history.undo().atlas.worlds.w.territories,{});
  assert.deepEqual(history.redo().atlas.worlds.w.territories,world.territories);
  const next=previewContinent(atlas,'w','other',DEFAULT_CONTINENT,{natural:true,keepCoastline:true}).transaction.apply(atlas);
  assert.deepEqual(next.worlds.w.territories,world.territories);
  assert.match(territorySvg(world),/stroke-dasharray/);world.showTerritories=false;assert.equal(territorySvg(world),'');
  assert.deepEqual(world.geography,atlas.worlds.w.geography);
});
test('territory validation rejects invalid ownership, priority, visibility and self-crossing borders',()=>{
  const atlas=fixture(),realm=atlas.boards.w.placeIds[0];
  const region=newBiome('border','territory',[[0,0],[100,0],[0,100]]);
  assert.throws(()=>assignTerritory(region,'missing',atlas,'w'));
  atlas.worlds.w.territories.border=assignTerritory(region,realm,atlas,'w');
  for(const corrupt of [w=>w.territories.border.realmId='missing',w=>w.territories.border.priority=NaN,w=>w.showTerritories='yes',w=>w.territories.border.points=[[0,0],[100,100],[0,100],[100,0]]]) {
    const bad=structuredClone(atlas);corrupt(bad.worlds.w);assert.throws(()=>validateAtlas(bad));
  }
});
