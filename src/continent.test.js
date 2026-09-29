import test from 'node:test';
import assert from 'node:assert/strict';
import { generateContinent, DEFAULT_CONTINENT, CONTINENT_PRESETS, independentShape } from './continent.js';
import { MAX_TERRAIN_SAMPLES } from './landmass.js';
import { previewContinent } from './world-planning.js';
import { worldLandShape } from './world-generator.js';
import { artworkForBoard, worldRealms } from './cartography.js';
import { validateAtlas, serializeAtlas } from './atlas.js';
import { createHistory } from './editor.js';
import { addVillageExample } from './campaign.js';

function fixture() { return {schemaVersion:1,rootBoardId:'world',boards:{world:{id:'world',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}}; }

test('all continent presets produce bounded deterministic closed contours with no realms',()=>{
  const shapes=[];
  for(const preset of CONTINENT_PRESETS) {
    const settings={...DEFAULT_CONTINENT,preset};
    const terrain=generateContinent('coast',settings);
    assert.ok(terrain.samples<=MAX_TERRAIN_SAMPLES);
    assert.ok(terrain.rings.length>0);
    assert.ok(terrain.rings.every(r=>r.length>5 && r.length<20000 && r.flat().every(Number.isFinite)));
    assert.deepEqual(terrain,generateContinent('coast',settings));
    assert.notDeepEqual(terrain.rings,generateContinent('different',settings).rings);
    shapes.push(JSON.stringify(terrain.rings));
    const atlas=previewContinent(fixture(),'world','coast',settings).transaction.apply(fixture());
    assert.match(artworkForBoard(atlas.boards.world,atlas),/fill-rule="evenodd"/);
    assert.doesNotMatch(artworkForBoard(atlas.boards.world,atlas),/NaN|Infinity|undefined/);
  }
  assert.equal(new Set(shapes).size,CONTINENT_PRESETS.length);
});

test('conversion preserves campaign identities, supports undo and round trips, and does not mutate previews',()=>{
  const atlas=fixture(); addVillageExample(atlas);
  const before=structuredClone(atlas),history=createHistory(atlas);
  const preview=previewContinent(atlas,'world','campaign',DEFAULT_CONTINENT);
  assert.deepEqual(atlas,before);
  const converted=preview.transaction.apply(atlas);
  for(const collection of ['places','boards','routes','sessions']) for(const [id,item] of Object.entries(before[collection])) {
    for(const [key,value] of Object.entries(item)) assert.deepEqual(converted[collection][id][key],value);
  }
  const reloaded=validateAtlas(JSON.parse(serializeAtlas(converted)));
  assert.deepEqual(reloaded,converted);
  history.record(converted,{manual:false}); assert.deepEqual(history.undo().atlas,before);
  assert.deepEqual(history.redo().atlas,converted);
  const cancelled=previewContinent(atlas,'world','cancel',DEFAULT_CONTINENT);cancelled.transaction.cancel();
  assert.throws(()=>cancelled.transaction.apply(atlas),/closed/);assert.deepEqual(atlas,before);
});

test('moving, adding, renaming or deleting realms cannot alter independent geography or rendering',()=>{
  const atlas=fixture();addVillageExample(atlas);
  const converted=previewContinent(atlas,'world','stable',DEFAULT_CONTINENT).transaction.apply(atlas);
  const shape=structuredClone(independentShape(converted.worlds.world));
  const svg=artworkForBoard(converted.boards.world,converted);
  const realm=converted.places[converted.boards.world.placeIds[0]];
  realm.x=8000;realm.y=-3000;realm.name='Changed';realm.island=true;realm.biome='snow';
  assert.deepEqual(worldLandShape(worldRealms(converted.boards.world,converted),'ignored',converted.worlds.world),shape);
  assert.equal(artworkForBoard(converted.boards.world,converted),svg);
  converted.boards.world.placeIds.push('extra');converted.places.extra={type:'continent',x:4,y:9};
  assert.equal(artworkForBoard(converted.boards.world,converted),svg);
  converted.boards.world.placeIds=[];
  assert.equal(artworkForBoard(converted.boards.world,converted),svg);
});

test('settings handle negative and large coordinates and reject malformed imports',()=>{
  const settings={...DEFAULT_CONTINENT,width:1000000,height:100000,centerX:-1000000,centerY:-900000};
  assert.ok(generateContinent('large',settings).samples<=MAX_TERRAIN_SAMPLES);
  for(const invalid of [{width:NaN},{height:0},{preset:'unknown'},{roughness:2},{width:1000000,height:200}]) assert.throws(()=>generateContinent('seed',{...DEFAULT_CONTINENT,...invalid}));
  const converted=previewContinent(fixture(),'world','s',DEFAULT_CONTINENT).transaction.apply(fixture());
  converted.worlds.world.settings.width=-5;assert.throws(()=>validateAtlas(converted));
});

test('regeneration retains protected coastlines and independent layers',()=>{
  const original=fixture(),atlas=previewContinent(original,'world','first',DEFAULT_CONTINENT).transaction.apply(original);
  const world=atlas.worlds.world;
  world.geography['coastline-0'].protected=true;
  const kept=structuredClone(world.geography['coastline-0']);
  world.biomes.forest={id:'forest',type:'forest',points:[[0,0],[10,0],[0,10]],priority:1,editState:'manually-edited',protected:true};
  const next=previewContinent(atlas,'world','second',DEFAULT_CONTINENT).transaction.apply(atlas);
  assert.deepEqual(next.worlds.world.geography['coastline-0'],kept);
  assert.deepEqual(next.worlds.world.biomes,world.biomes);
});
