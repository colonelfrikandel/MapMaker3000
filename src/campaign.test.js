import test from 'node:test';
import assert from 'node:assert/strict';
import { addVillageExample, addCampaignEvent, planSettlement, applySettlement } from './campaign.js';
import { buildLayout } from './geometry.js';
import { validateTownBase, townBaseSvg } from './town-base.js';
import { artworkForBoard } from './cartography.js';
import { generateTownBase } from './town-generator.js';
import { overlaps, roadDistance } from './village-generator.js';
import { clearOfGeography } from './settlement-geography.js';

function fixture() {
  return {schemaVersion:1,rootBoardId:'world',boards:{world:{id:'world',kind:'world',name:'My world',placeIds:[]}},places:{},routes:{},sessions:{}};
}
test('example adds countryside, village and interior without replacing existing data or duplicating itself',()=>{
  const atlas=fixture();atlas.sessions.kept={notes:'Existing campaign'};
  const villageId=addVillageExample(atlas), village=atlas.boards[villageId];
  const snapshot=JSON.stringify(atlas);
  assert.equal(addVillageExample(atlas),villageId);
  assert.equal(JSON.stringify(atlas),snapshot);
  assert.equal(atlas.sessions.kept.notes,'Existing campaign');
  assert.equal(atlas.boards.world.name,'My world');
  const tavern=atlas.places[village.placeIds[0]],interior=atlas.boards[tavern.childBoardId];
  assert.equal(interior.placeIds.length,4);
  const layout=buildLayout(atlas);
  assert.equal(layout.boards.get(villageId).depth,3);
  assert.equal(layout.boards.get(interior.id).depth,4);
  const valley=atlas.boards[atlas.places[village.parentPlaceId].boardId];
  assert.match(artworkForBoard(valley,atlas),/<svg/);
});
test('regeneration and JSON round trips preserve campaign facts, footprint geometry and interiors',()=>{
  let atlas=fixture();const villageId=addVillageExample(atlas);
  const village=atlas.boards[villageId],tavern=atlas.places[village.placeIds[0]];
  tavern.name='The Party’s Inn';tavern.notes='The party bought this tavern.';
  addCampaignEvent(tavern,'Hidden cellar','Found behind the barrels.','Session 4');
  const original=structuredClone(tavern), interior=structuredClone(atlas.boards[tavern.childBoardId]);
  const polygon=structuredClone(village.baseMap.layers.buildings[tavern.baseFootprintIndex]);
  const scenery=structuredClone(village.baseMap.layers.buildings);
  for (const size of ['large','small','standard']) {
    const before=JSON.stringify(atlas),plan=planSettlement(village,atlas.places,`new-${size}`,size);
    assert.equal(JSON.stringify(atlas),before,'preview must not mutate the atlas');
    applySettlement(village,atlas.places,plan);
    assert.deepEqual({...tavern,baseFootprintIndex:original.baseFootprintIndex},original);
    assert.deepEqual(atlas.boards[tavern.childBoardId],interior);
    assert.deepEqual(village.baseMap.layers.buildings[tavern.baseFootprintIndex],polygon);
    assert.equal(validateTownBase(village.baseMap),village.baseMap);
    for(const [i,shape] of village.baseMap.layers.buildings.entries()) if(i!==tavern.baseFootprintIndex) assert.equal(overlaps(shape,polygon),false);
  }
  assert.notDeepEqual(village.baseMap.layers.buildings,scenery);
  atlas=JSON.parse(JSON.stringify(atlas));
  assert.equal(atlas.places[tavern.id].events[0].title,'Hidden cellar');
  assert.deepEqual(atlas.boards[tavern.childBoardId],interior);
});
test('villages have connected roads, a river crossing, non-overlapping roadside plots and repeatable geometry',()=>{
  for (const size of ['small','standard','large']) for(const seed of ['Brackenford','Oakrest','river','42']) {
    const base=generateTownBase('village',seed,size);
    assert.deepEqual(base,generateTownBase('village',seed,size));
    assert.ok(base.layers.buildings.length>25);
    assert.ok(base.layers.fields.length>3);
    assert.equal(base.layers.planks.length,1);
    assert.equal(validateTownBase(base),base);
    assert.doesNotMatch(townBaseSvg(base),/NaN|Infinity|undefined/);
    for(const [i,p] of base.layers.buildings.entries()) {
      assert.ok(clearOfGeography(p,base.layers));
      const center=p.reduce((a,v)=>[a[0]+v[0]/4,a[1]+v[1]/4],[0,0]);
      assert.ok(roadDistance(...center,base.layers.roads)<45);
      for(const q of base.layers.buildings.slice(i+1)) assert.equal(overlaps(p,q),false);
    }
    const connected=[base.layers.roads[0]];
    for(const road of base.layers.roads.slice(1)) {
      assert.ok(connected.some(prior=>prior.points.some(p=>p[0]===road.points[0][0] && p[1]===road.points[0][1])));
      connected.push(road);
    }
  }
});
test('legacy houses without footprint indices gain stable anchors; named houses survive size reductions',()=>{
  const base=generateTownBase('town','legacy','large');
  const board={kind:'town',baseMap:base,placeIds:['house']};
  const places={house:{id:'house',type:'house',x:430,y:260,name:'Old inn',notes:'Keep'}};
  const plan=planSettlement(board,places,'smaller','small');applySettlement(board,places,plan);
  assert.equal(places.house.x,430);assert.equal(places.house.y,260);
  assert.ok(board.baseMap.layers.buildings[places.house.baseFootprintIndex]);
  const again=planSettlement(board,places,'again','small');
  assert.deepEqual(again.base.layers.buildings[again.indices.house],board.baseMap.layers.buildings[places.house.baseFootprintIndex]);
});
test('events require a title and retain literal text for safe DOM rendering',()=>{
  const place={};assert.throws(()=>addCampaignEvent(place,'   '));
  const event=addCampaignEvent(place,' <img onerror=alert(1)> ','notes','Session 1');
  assert.equal(event.title,'<img onerror=alert(1)>');assert.equal(event.provenance.kind,'manual');
});
