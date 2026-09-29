import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTownBase } from './town-generator.js';
import { GEOGRAPHY_LAYERS, VILLAGE_TYPES, clearOfGeography, geographyFor, polygonDistance } from './settlement-geography.js';
import { planSettlement, applySettlement } from './campaign.js';
import { validateTownBase } from './town-base.js';

for (const type of VILLAGE_TYPES) {
  test(`${type}: distinct seeded geography, buildable plots and preserved campaign history`, () => {
    const base=generateTownBase('village','atlas','standard',[],{type});
    assert.deepEqual(base,generateTownBase('village','atlas','standard',[],{type}));
    assert.notDeepEqual(base.layers.roads,generateTownBase('village','another','standard',[],{type}).layers.roads);
    assert.equal(validateTownBase(base),base);
    assert.ok(base.layers.buildings.length>20);
    assert.equal(base.layers.water.length,type==='crossroads'?0:1);
    assert.equal(base.layers.planks.length,type==='river'?1:type==='coastal'?3:0);
    for (const shape of base.layers.buildings) assert.ok(clearOfGeography(shape,base.layers));
    // Every road joins the component of roads that have already been visited.
    const connected=[base.layers.roads[0]],remaining=base.layers.roads.slice(1);
    while(remaining.length) {
      const index=remaining.findIndex(r=>connected.some(c=>r.points.some(p=>c.points.some(q=>p[0]===q[0]&&p[1]===q[1]))));
      assert.notEqual(index,-1,'all streets connect');connected.push(...remaining.splice(index,1));
    }
    const polygon=base.layers.buildings[0],center=polygon.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
    const places={inn:{id:'inn',type:'house',x:center[0]-76,y:center[1]-49,baseFootprintIndex:0,name:'Named tavern',notes:'Bought by the party',childBoardId:'interior',events:[{title:'First meeting'}]}};
    const board={kind:'village',placeIds:['inn'],baseMap:base},before=structuredClone(places);
    const plan=planSettlement(board,places,'next','small',{type,keepGeography:true});
    assert.deepEqual(places,before,'preview does not mutate campaign data');
    applySettlement(board,places,plan);
    assert.deepEqual(places,before);
    assert.deepEqual(board.baseMap.layers.buildings[places.inn.baseFootprintIndex],polygon);
    for(const layer of GEOGRAPHY_LAYERS) assert.deepEqual(board.baseMap.layers[layer],base.layers[layer]);
    places.inn.keepPlace=false;
    const unlocked=planSettlement(board,places,'move','large',{type,keepGeography:false});
    applySettlement(board,places,unlocked);
    assert.equal(places.inn.name,'Named tavern');assert.equal(places.inn.childBoardId,'interior');
    assert.deepEqual(places.inn.events,before.inn.events);
    assert.ok(clearOfGeography(board.baseMap.layers.buildings[places.inn.baseFootprintIndex],board.baseMap.layers));
    const saved=JSON.parse(JSON.stringify({board,places}));
    assert.equal(saved.board.keepGeography,false);assert.equal(saved.places.inn.keepPlace,false);
  });
}
test('kept buildings survive fresh geography and conflicting geography never mutates the atlas',()=>{
  const base=generateTownBase('village','Brackenford','standard');
  const board={kind:'village',placeIds:['inn'],baseMap:base};
  const places={inn:{id:'inn',type:'house',x:424,y:220,baseFootprintIndex:null,name:'Inn'}};
  const before=JSON.stringify({board,places});
  const plan=planSettlement(board,places,'fresh','standard',{type:'crossroads',keepGeography:false});
  assert.equal(JSON.stringify({board,places}),before);
  assert.ok(clearOfGeography(plan.base.layers.buildings[plan.indices.inn],plan.base.layers));
  places.inn.x=870;places.inn.y=260;
  const conflict=JSON.stringify({board,places});
  assert.throws(()=>planSettlement(board,places,'coast','standard',{type:'coastal',keepGeography:false}),/cannot fit/);
  assert.equal(JSON.stringify({board,places}),conflict);
  assert.throws(()=>planSettlement(board,places,'coast','standard',{type:'coastal',keepGeography:true}),/Uncheck/);
});
test('constraint checks catch edge crossings, not just vertices inside water',()=>{
  assert.equal(polygonDistance([[0,4],[10,4],[10,6],[0,6]],[[4,0],[6,0],[6,10],[4,10]]),0);
  assert.notDeepEqual(geographyFor('river','one').layers.water,geographyFor('river','two').layers.water);
});
