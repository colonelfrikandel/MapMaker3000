import test from 'node:test';
import assert from 'node:assert/strict';
import {generateContinent,DEFAULT_CONTINENT} from './continent.js';
import {AZGAAR_TEMPLATES} from './azgaar-terrain.js';
import {previewContinent} from './world-planning.js';
import {validateAtlas,serializeAtlas} from './atlas.js';
import {createHistory} from './editor.js';
import {sampleTerrainHeight,terrainElevation} from './terrain-heightmap.js';
const settings={...DEFAULT_CONTINENT,shapeVersion:4,azgaarTemplate:'continents'};
const fixture=()=>({schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}});

test('physical campaign base uses the saved Azgaar heights and never invents biomes or places',()=>{
  const a=fixture();
  const next=previewContinent(a,'w','baseline',settings,{physical:true}).transaction.apply(a);
  const w=next.worlds.w,f=w.fields;
  assert.deepEqual(w.biomes,{});
  assert.deepEqual(next.places,a.places);
  for(const [id,board] of Object.entries(a.boards))for(const [key,value] of Object.entries(board))assert.deepEqual(next.boards[id][key],value);
  for(const type of ['river','mountain'])assert.ok(Object.values(w.geography).some(g=>g.type===type),type);
  for(let i=0;i<f.land.length;i++) {
    const x=f.x+i%f.nx*f.step,y=f.y+Math.floor(i/f.nx)*f.step;
    const expected=f.land[i]?Math.round(terrainElevation(sampleTerrainHeight(w.terrainHeightmap,w.settings,x,y))*100)/100:0;
    assert.equal(f.elevation[i],expected);
    if(f.downstream[i]>=0)assert.ok(f.filled[f.downstream[i]]<f.filled[i]);
  }
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(next))),next);
  w.biomes.known={id:'known',type:'forest',points:[[400,300],[450,300],[420,340]],priority:1,editState:'manually-edited',protected:true};
  const known=structuredClone(w.biomes.known);
  const regenerated=previewContinent(next,'w','later',settings,{physical:true,keepCoastline:true}).transaction.apply(next);
  assert.deepEqual(regenerated.worlds.w.biomes,{known});
  assert.deepEqual(regenerated.worlds.w.fields.elevation,f.elevation);
  const bare=previewContinent(regenerated,'w','bare',settings,{keepCoastline:true}).transaction.apply(regenerated);
  assert.equal(bare.worlds.w.fields,undefined);
  assert.deepEqual(bare.worlds.w.biomes,{known});
});

test('all original Azgaar recipes generate bounded terrain without changing global randomness',()=>{
  const random=Math.random;
  for(const {id} of AZGAAR_TEMPLATES) {
    const s={...settings,azgaarTemplate:id};
    const a=generateContinent('baseline',s),b=generateContinent('baseline',s);
    assert.deepEqual(a,b,id);
    assert.ok(a.rings.length>0,id);
    assert.ok(a.samples<=140000,id);
    assert.equal(a.heightmap.values.length,a.heightmap.nx*a.heightmap.ny);
    assert.ok(a.heightmap.values.some(v=>v>=20));
    assert.ok(a.heightmap.values.some(v=>v<20));
    for(const ring of a.rings)assert.ok(ring.flat().every(Number.isFinite));
    assert.equal(Math.random,random);
  }
  assert.notDeepEqual(generateContinent('one',settings).rings,generateContinent('two',settings).rings);
});
test('Azgaar handles extreme map coordinates and rejects unknown recipes',()=>{
  for(const dims of [{width:1000000,height:100000},{width:200,height:2000}]) {
    const s={...settings,...dims,centerX:-1000000,centerY:2000000};
    const a=generateContinent('large',s);
    for(const ring of a.rings)for(const [x,y] of ring) {
      assert.ok(Math.abs(x-s.centerX)<=s.width/2+10);
      assert.ok(Math.abs(y-s.centerY)<=s.height/2+10);
    }
  }
  assert.throws(()=>generateContinent('seed',{...settings,azgaarTemplate:'unknown'}),/template/);
});
test('Azgaar previews preserve atlas identity and heightmaps across undo and save/load',()=>{
  const a=fixture(),before=structuredClone(a),history=createHistory(a);
  const p=previewContinent(a,'w','baseline',settings);
  assert.deepEqual(a,before);
  const next=p.transaction.apply(a);
  assert.equal(next.worlds.w.generator.version,'4');
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(next))),next);
  const saved=structuredClone(next);
  next.worlds.w.geography['coastline-0'].protected=true;
  const kept=structuredClone(next.worlds.w.geography['coastline-0']);
  const regenerated=previewContinent(next,'w','another',settings).transaction.apply(next);
  assert.deepEqual(regenerated.worlds.w.geography['coastline-0'],kept);
  const same=previewContinent(next,'w','another',settings,{keepCoastline:true}).transaction.apply(next);
  assert.deepEqual(same.worlds.w.terrainHeightmap,next.worlds.w.terrainHeightmap);
  const cancelled=previewContinent(next,'w','cancel',settings);cancelled.transaction.cancel();
  assert.throws(()=>cancelled.transaction.apply(next),/closed/);
  history.record(saved,{manual:false});assert.deepEqual(history.undo().atlas,before);assert.deepEqual(history.redo().atlas,saved);
  const invalid=structuredClone(saved);invalid.worlds.w.terrainHeightmap.values.pop();assert.throws(()=>validateAtlas(invalid),/heightmap/);
});
