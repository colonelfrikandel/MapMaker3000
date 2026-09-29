import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePlaceEnvironment } from './environment.js';
import { buildLayout } from './geometry.js';
import { circleAnchors } from './biome-curves.js';

function fixture() {
  return {rootBoardId:'w',boards:{w:{id:'w',kind:'world',placeIds:['realm']},r:{id:'r',kind:'continent',parentPlaceId:'realm',placeIds:['village']}},places:{realm:{id:'realm',boardId:'w',type:'continent',x:-200,y:70,childBoardId:'r'},village:{id:'village',boardId:'r',type:'village',x:400,y:250}},routes:{},worlds:{w:{id:'w',mode:'independent',geography:{coast:{type:'coastline',points:[[-1000,-1000],[1000,-1000],[1000,1000],[-1000,1000]]}},biomes:{}}}};
}
test('nested sites use rendered centers and live curved biomes without mutating campaign data',()=>{
  const a=fixture(),layout=buildLayout(a),rect=layout.places.get('village');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  a.worlds.w.biomes.forest={id:'forest',type:'forest',points:circleAnchors(x,y,30),holes:[],curved:true,boundaryVersion:2,priority:1,protected:true};
  const before=structuredClone(a),c=samplePlaceEnvironment(a,'village');
  assert.equal(c.x,x);assert.equal(c.y,y);assert.equal(c.biome,'forest');assert.deepEqual(c.resources,['timber']);
  assert.equal(c.elevation,null);assert.deepEqual(a,before);
  a.places.realm.x+=300;
  assert.equal(samplePlaceEnvironment(a,'village').biome,null);
});
test('priority, holes and water override biome context; roads use nested map transforms',()=>{
  const a=fixture(),c=samplePlaceEnvironment(a,'village'),points=circleAnchors(c.x,c.y,30);
  a.worlds.w.biomes={a:{id:'a',type:'forest',points,priority:1,boundaryVersion:2},b:{id:'b',type:'desert',points,priority:2,boundaryVersion:2}};
  assert.equal(samplePlaceEnvironment(a,'village').biome,'desert');
  a.worlds.w.biomes.b.holes=[circleAnchors(c.x,c.y,10)];
  assert.equal(samplePlaceEnvironment(a,'village').biome,'forest');
  a.places.other={id:'other',boardId:'r',type:'village',x:600,y:250};a.boards.r.placeIds.push('other');
  a.routes.road={id:'road',boardId:'r',fromPlaceId:'village',toPlaceId:'other',type:'road'};
  assert.equal(samplePlaceEnvironment(a,'village').nearbyRoad,true);
  a.worlds.w.geography.lake={type:'lake',points};
  const water=samplePlaceEnvironment(a,'village');assert.equal(water.surface,'water');assert.equal(water.biome,null);assert.equal(water.nearbyWater,true);
  assert.deepEqual(water.resources,['freshwater']);
});
test('plain land has no invented ecology and legacy worlds remain unchanged',()=>{
  const a=fixture(),c=samplePlaceEnvironment(a,'village');
  assert.equal(c.biome,null);assert.equal(c.rainfall,null);assert.equal(c.temperature,null);assert.deepEqual(c.resources,[]);
  a.worlds.w.mode='legacy-realms';assert.equal(samplePlaceEnvironment(a,'village'),null);
  assert.equal(samplePlaceEnvironment(a,'missing'),null);
});
