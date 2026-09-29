import test from 'node:test';
import assert from 'node:assert/strict';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT, continentSvg, independentShape } from './continent.js';
import { generateNaturalGeography, drainTerrain } from './natural-geography.js';
import { validateAtlas, serializeAtlas } from './atlas.js';
import { createHistory } from './editor.js';
import { worldSurfaceAt } from './world-generator.js';

function fixture(seed='test') {
  const atlas={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{s:{notes:'Keep campaign history'}}};
  return previewContinent(atlas,'w',seed,DEFAULT_CONTINENT,{natural:true}).transaction.apply(atlas);
}

test('natural geography is deterministic, bounded, serializable and produces rivers, lakes, mountains and biomes',()=>{
  const atlas=fixture(),world=atlas.worlds.w;
  const generated=generateNaturalGeography(world,'test');
  assert.deepEqual(generated.fields,world.fields);
  assert.deepEqual(generated.biomes,world.biomes);
  assert.ok(world.fields.nx*world.fields.ny<=12000);
  for(const type of ['river','lake','mountain']) assert.ok(Object.values(world.geography).some(g=>g.type===type),type);
  assert.ok(new Set(Object.values(world.biomes).map(b=>b.type)).size>=4);
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(atlas))),atlas);
  assert.doesNotMatch(continentSvg(world),/NaN|Infinity|undefined/);
});

test('all drainage paths reach water without cycles and rivers follow non-increasing water surface elevation',()=>{
  for(const seed of ['test','dry','winter']) {
    const world=fixture(seed).worlds.w,f=world.fields;
    for(let i=0;i<f.land.length;i++)if(f.land[i]) {
      let j=i,steps=0;
      while(f.downstream[j]>=0) {const next=f.downstream[j];assert.ok(f.filled[next]<f.filled[j]);j=next;assert.ok(++steps<f.land.length);}
      assert.equal(f.land[j],0);
    }
    for(const river of Object.values(world.geography).filter(g=>g.type==='river'))for(let i=1;i<river.cells.length;i++)assert.equal(f.downstream[river.cells[i-1]],river.cells[i]);
    for(const lake of Object.values(world.geography).filter(g=>g.type==='lake')) {
      assert.ok(Number.isInteger(lake.outletCell)&&lake.outletCell>=0);
      assert.ok(Number.isFinite(lake.surfaceLevel));
    }
  }
});

test('priority flood fills a depression to its outlet, rather than routing uphill through dry ground',()=>{
  const land=[0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1,0,0,0,0,0,0];
  const elevation=land.map(v=>v?100:0);elevation[12]=10;
  const result=drainTerrain(elevation,land,5,5);
  assert.ok(result.filled[12]>100);assert.ok(result.filled[result.downstream[12]]<result.filled[12]);
});

test('climate responds to latitude and elevation and biome polygons carry editable identities',()=>{
  const world=fixture().worlds.w,f=world.fields;
  const north=f.temperature[0],south=f.temperature[(f.ny-1)*f.nx];
  assert.ok(south>north);
  for(let i=0;i<f.land.length;i++)if(f.elevation[i]>1500)assert.ok(f.temperature[i]<28-f.elevation[i]*.006);
  for(const [id,b]of Object.entries(world.biomes)){assert.equal(b.id,id);assert.equal(b.editState,'generated');assert.equal(b.priority,0);assert.ok(b.points.length>=3);}
});

test('geography-only previews retain coasts and manual overrides, cancel cleanly and support undo',()=>{
  const atlas=fixture(),world=atlas.worlds.w;
  const river=Object.values(world.geography).find(g=>g.type==='river');river.protected=true;
  const biome=Object.values(world.biomes)[0];biome.editState='manually-edited';biome.priority=7;
  const before=structuredClone(atlas),history=createHistory(atlas);
  const preview=previewContinent(atlas,'w','new-climate',DEFAULT_CONTINENT,{natural:true,keepCoastline:true});
  assert.deepEqual(atlas,before);
  const next=preview.transaction.apply(atlas);
  assert.deepEqual(next.worlds.w.geography['coastline-0'],world.geography['coastline-0']);
  assert.deepEqual(next.worlds.w.geography[river.id],river);assert.deepEqual(next.worlds.w.biomes[biome.id],biome);
  assert.notDeepEqual(next.worlds.w.fields,world.fields);assert.deepEqual(next.sessions,atlas.sessions);
  history.record(next,{manual:false});assert.deepEqual(history.undo().atlas,before);
  const cancelled=previewContinent(atlas,'w','cancel',DEFAULT_CONTINENT,{natural:true,keepCoastline:true});cancelled.transaction.cancel();
  assert.throws(()=>cancelled.transaction.apply(atlas));assert.deepEqual(atlas,before);
});

test('invalid fields, river widths, polygon holes and drainage graphs are rejected',()=>{
  const atlas=fixture();
  for(const corrupt of [w=>w.fields.nx=1e9,w=>w.fields.elevation[0]=NaN,w=>w.fields.downstream[0]=0,w=>Object.values(w.geography).find(g=>g.type==='river').width=-1,w=>Object.values(w.biomes)[0].holes=[[[0,0]]]]) {
    const input=structuredClone(atlas);corrupt(input.worlds.w);assert.throws(()=>validateAtlas(input));
  }
});

test('surface lookup recognizes inland lakes and preserves holes as islands',()=>{
  const shape=independentShape(fixture().worlds.w);
  shape.lakes=[{points:[[0,0],[100,0],[100,100],[0,100]],holes:[[[30,30],[60,30],[60,60],[30,60]]]}];
  assert.equal(worldSurfaceAt(shape,10,10).kind,'water');
  // Lake hole falls through to the underlying continental land mask.
  shape.landRings=[[[0,0],[100,0],[100,100],[0,100]]];
  assert.equal(worldSurfaceAt(shape,40,40).kind,'mainland');
});
