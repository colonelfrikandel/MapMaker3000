import test from 'node:test';
import assert from 'node:assert/strict';
import { generateContinent, DEFAULT_CONTINENT, validateContinentSettings } from './continent.js';
import { shapeControls, CONTINENT_SLIDERS } from './continent-controls.js';
import { previewContinent } from './world-planning.js';
import { validateAtlas, serializeAtlas } from './atlas.js';
import { createHistory } from './editor.js';

const settings=shapeControls(DEFAULT_CONTINENT);
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
const land=shape=>shape.rings.reduce((sum,ring)=>sum+area(ring),0);
const aspect=ring=>{const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);return (Math.max(...xs)-Math.min(...xs))/(Math.max(...ys)-Math.min(...ys));};
test('slider shapes repeat, vary with seed, and retain one substantial mainland at low fragmentation',()=>{
  for(const seed of ['coast','Avalon','rift','mainland','snow']) {
    const s={...settings,islandAmount:0,fragmentation:0};
    const terrain=generateContinent(seed,s);
    assert.equal(terrain.rings.length,1);
    assert.deepEqual(terrain,generateContinent(seed,s));
    assert.notDeepEqual(terrain.rings,generateContinent(seed+'new',s).rings);
    assert.ok(terrain.samples<=140000);
    assert.ok(land(terrain)>s.width*s.height*.15);
    const many=generateContinent(seed,{...s,fragmentation:1});
    assert.ok(many.rings.length>terrain.rings.length);
    const islands=generateContinent(seed,{...s,islandAmount:1});
    assert.ok(islands.rings.length>terrain.rings.length);
    assert.ok(land(generateContinent(seed,{...s,coverage:1}))>land(generateContinent(seed,{...s,coverage:0}))*2);
    const horizontal=generateContinent(seed,{...s,elongation:1,orientation:'horizontal'});
    const vertical=generateContinent(seed,{...s,elongation:1,orientation:'vertical'});
    assert.ok(aspect(horizontal.rings[0])>aspect(vertical.rings[0])*3);
    assert.notDeepEqual(generateContinent(seed,{...s,coastComplexity:0}).rings,generateContinent(seed,{...s,coastComplexity:1}).rings);
  }
});
test('slider extremes stay finite and bounded, and invalid settings are rejected',()=>{
  for(const value of [0,1]) {
    const extreme={...settings,...Object.fromEntries(CONTINENT_SLIDERS.map(c=>[c.key,value])),centerX:-1000000,centerY:2000000};
    const shape=generateContinent('extreme',extreme);
    for(const ring of shape.rings)for(const [x,y] of ring) {
      assert.ok(Number.isFinite(x)&&Number.isFinite(y));
      assert.ok(Math.abs(x-extreme.centerX)<extreme.width/2);
      assert.ok(Math.abs(y-extreme.centerY)<extreme.height/2);
    }
  }
  for(const {key} of CONTINENT_SLIDERS)for(const value of [NaN,-1,2])assert.throws(()=>validateContinentSettings({...settings,[key]:value}));
  assert.throws(()=>validateContinentSettings({...settings,orientation:'diagonal'}));
});
test('new shape settings survive preview, apply, undo, and export without changing saved content',()=>{
  const atlas={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const before=structuredClone(atlas),history=createHistory(atlas);
  const preview=previewContinent(atlas,'w','new-shape',settings);
  assert.deepEqual(atlas,before);
  const next=preview.transaction.apply(atlas);
  assert.equal(next.worlds.w.generator.version,'3');
  assert.deepEqual(next.worlds.w.settings,settings);
  assert.deepEqual(validateAtlas(JSON.parse(serializeAtlas(next))),next);
  history.record(next,{manual:false});assert.deepEqual(history.undo().atlas,before);
  assert.deepEqual(history.redo().atlas,next);
  const cancelled=previewContinent(next,'w','another',settings);cancelled.transaction.cancel();
  assert.throws(()=>cancelled.transaction.apply(next),/closed/);
});
