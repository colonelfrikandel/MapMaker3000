import test from 'node:test';
import assert from 'node:assert/strict';
import { newBiome,editBiome,validateBiomePolygon,biomeAtPoint,removeBiome } from './biome-editor.js';
import { createHistory } from './editor.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { serializeAtlas,validateAtlas } from './atlas.js';

const square=()=>newBiome('forest','forest',[[0,0],[100,0],[100,100],[0,100]]);

test('polygon operations are immutable and protect edits, including holes and insertion',()=>{
  const original=square();original.holes=[[[20,20],[40,20],[40,40],[20,40]]];
  const before=structuredClone(original);
  const moved=editBiome(original,{kind:'move',dx:10,dy:-7});
  assert.deepEqual(original,before);assert.deepEqual(moved.holes[0][0],[30,13]);
  let changed=editBiome(original,{kind:'insert',ring:0,index:0});
  assert.equal(changed.points.length,5);assert.deepEqual(changed.points[1],[50,0]);
  changed=editBiome(changed,{kind:'vertex',ring:0,index:1,point:[50,-20]});
  assert.deepEqual(changed.points[1],[50,-20]);
  changed=editBiome(changed,{kind:'delete-vertex',ring:0,index:1});
  assert.deepEqual(changed.points,original.points);assert.equal(changed.protected,true);assert.equal(changed.editState,'manually-edited');
  assert.equal(editBiome(changed,{kind:'properties',type:'desert',priority:8}).priority,8);
});

test('invalid polygons, self crossings, edge reversals, and escaped/overlapping holes are rejected',()=>{
  for(const points of [ [[0,0],[100,100],[0,100],[100,0]], [[0,0],[0,0],[100,100]], [[0,0],[100,0],[50,0],[50,100]], [[0,0],[1,0],[2,0]], [[0,0],[1,NaN],[2,0]] ])assert.throws(()=>newBiome('bad','forest',points));
  const triangle=newBiome('t','forest',[[0,0],[100,0],[0,100]]);
  assert.throws(()=>editBiome(triangle,{kind:'delete-vertex',index:0}));
  const region=square();region.holes=[[[80,80],[120,80],[120,120],[80,120]]];assert.throws(()=>validateBiomePolygon(region));
  region.holes=[[[10,10],[60,10],[60,60],[10,60]],[[50,50],[70,50],[70,70],[50,70]]];assert.throws(()=>validateBiomePolygon(region));
});

test('selection matches highest-priority rendering and respects holes and deterministic ties',()=>{
  const forest=square(),desert={...square(),id:'desert',type:'desert',priority:9};
  desert.holes=[[[20,20],[60,20],[60,60],[20,60]]];
  assert.equal(biomeAtPoint({forest,desert},10,10).id,'desert');
  assert.equal(biomeAtPoint({forest,desert},30,30).id,'forest');
  assert.equal(biomeAtPoint({forest,desert},150,150),null);
  desert.priority=forest.priority;assert.equal(biomeAtPoint({forest,desert},10,10).id,'forest');
});

test('manual edits, deletions and undo survive regeneration and JSON round trips',()=>{
  const source={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const atlas=previewContinent(source,'w','test',DEFAULT_CONTINENT,{natural:true}).transaction.apply(source);
  const history=createHistory(atlas),world=atlas.worlds.w;
  const [first,second]=Object.keys(world.biomes);
  world.biomes[first]=editBiome(world.biomes[first],{kind:'properties',type:'desert',priority:5});
  history.record(atlas,{manual:false});
  const beforeDelete=structuredClone(atlas);removeBiome(world,second);history.record(atlas,{manual:false});
  assert.deepEqual(history.undo().atlas,beforeDelete);
  assert.deepEqual(history.redo().atlas,atlas);
  const reloaded=validateAtlas(JSON.parse(serializeAtlas(atlas)));
  const next=previewContinent(reloaded,'w','test',DEFAULT_CONTINENT,{natural:true,keepCoastline:true}).transaction.apply(reloaded);
  assert.deepEqual(next.worlds.w.biomes[first],world.biomes[first]);
  assert.equal(next.worlds.w.biomes[second],undefined);
  assert.ok(next.worlds.w.biomeDeletions.includes(second));
});
