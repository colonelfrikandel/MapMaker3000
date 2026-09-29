import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAtlas, previewAtlasUpgrade, serializeAtlas } from './atlas.js';
import { addVillageExample, addCampaignEvent, planSettlement, applySettlement } from './campaign.js';
import { artworkForBoard } from './cartography.js';
import { buildLayout } from './geometry.js';

function fixture() {
  const atlas = {schemaVersion:1,rootBoardId:'world',boards:{world:{id:'world',kind:'world',name:'Campaign',placeIds:[]}},places:{},routes:{},sessions:{s1:{text:'Found the cellar'}}};
  const villageId = addVillageExample(atlas);
  const house = atlas.places[atlas.boards[villageId].placeIds[0]];
  house.notes = 'Owned by the party';
  addCampaignEvent(house,'Discovery','Secret cellar','s1');
  return {atlas,villageId,house};
}

test('upgrade preview leaves original untouched and preserves geography and campaign identity', () => {
  const {atlas} = fixture(), before = structuredClone(atlas);
  const art = artworkForBoard(atlas.boards.world,atlas), layout = buildLayout(atlas);
  const preview = previewAtlasUpgrade(atlas), upgraded = preview.atlas;
  assert.deepEqual(atlas,before);
  assert.equal(validateAtlas(atlas).schemaVersion,1,'loading must not upgrade');
  assert.equal(preview.fromVersion,1);
  assert.equal(upgraded.schemaVersion,2);
  assert.deepEqual(buildLayout(upgraded),layout);
  assert.equal(artworkForBoard(upgraded.boards.world,upgraded),art);
  for (const collection of ['boards','places','routes']) for (const [id,item] of Object.entries(before[collection])) {
    for (const [key,value] of Object.entries(item)) assert.deepEqual(upgraded[collection][id][key],value,`${id}.${key}`);
  }
  assert.deepEqual(upgraded.sessions,before.sessions);
  assert.deepEqual(upgraded.worlds.world.biomes,{});
  assert.equal(upgraded.worlds.world.mode,'legacy-realms');
  const village = Object.values(upgraded.places).find(p=>p.type==='village');
  assert.equal(village.environmentRef.worldBoardId,'world');
  assert.deepEqual(previewAtlasUpgrade(upgraded).atlas,upgraded,'upgrade is idempotent');
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(upgraded))),upgraded);
});

test('upgraded campaigns preserve protected buildings and interiors during regeneration', () => {
  const fixtureData = fixture(), atlas = previewAtlasUpgrade(fixtureData.atlas).atlas;
  const board = atlas.boards[fixtureData.villageId], house = atlas.places[fixtureData.house.id];
  const original = structuredClone(house), interior = structuredClone(atlas.boards[house.childBoardId]);
  const plan = planSettlement(board,atlas.places,'schema-two','small');
  applySettlement(board,atlas.places,plan);
  const saved = validateAtlas(JSON.parse(serializeAtlas(atlas)));
  assert.deepEqual({...saved.places[house.id],baseFootprintIndex:original.baseFootprintIndex},original);
  assert.deepEqual(saved.boards[house.childBoardId],interior);
});

test('layer identities, overrides and provenance survive save/load independently', () => {
  const atlas = previewAtlasUpgrade(fixture().atlas).atlas;
  const realm = Object.values(atlas.places).find(p=>p.type==='continent');
  const biome = {id:'forest-1',type:'forest',points:[[0,0],[100,0],[0,100]],priority:3,editState:'manually-edited',protected:true,provenance:{kind:'manual'}};
  atlas.worlds.world.biomes[biome.id] = biome;
  atlas.worlds.world.territories.realm = {...structuredClone(biome),id:'realm',type:'territory',realmId:realm.id};
  const saved = validateAtlas(JSON.parse(serializeAtlas(atlas)));
  assert.deepEqual(saved.worlds,atlas.worlds);
  saved.worlds.world.territories.realm.points[0][0] = 80;
  assert.equal(saved.worlds.world.biomes[biome.id].points[0][0],0);
});

test('invalid references and future formats fail without mutating input', () => {
  const atlas = previewAtlasUpgrade(fixture().atlas).atlas;
  for (const breakIt of [
    a=>a.schemaVersion=999,
    a=>a.sessions=[],
    a=>a.worlds.world.generator.version='future',
    a=>a.worlds.world.mode='independent',
    a=>Object.values(a.places)[0].id='wrong',
    a=>Object.values(a.places).find(p=>p.type==='village').environmentRef.worldBoardId='missing',
    a=>a.worlds.world.biomes.bad={id:'bad',type:'forest',priority:1,points:[[0,0],[1,0],[NaN,1]]},
    a=>a.worlds.world.territories.bad={id:'bad',type:'territory',realmId:'missing',points:[[0,0],[1,0],[0,1]]},
  ]) {
    const broken = structuredClone(atlas); breakIt(broken);
    const before = structuredClone(broken);
    assert.throws(()=>validateAtlas(broken)); assert.deepEqual(broken,before);
  }
});

test('legacy missing collections and footprints normalize without moving houses', () => {
  const {atlas,house} = fixture();
  delete atlas.routes; delete atlas.sessions; delete house.baseFootprintIndex;
  house.x += 3; house.y -= 2;
  const upgraded = previewAtlasUpgrade(atlas).atlas;
  assert.equal(upgraded.places[house.id].x,house.x);
  assert.equal(upgraded.places[house.id].y,house.y);
  assert.ok(Number.isInteger(upgraded.places[house.id].baseFootprintIndex));
  assert.deepEqual(upgraded.routes,{}); assert.deepEqual(upgraded.sessions,{});
});
