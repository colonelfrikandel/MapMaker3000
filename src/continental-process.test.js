import test from 'node:test';
import assert from 'node:assert/strict';
import { generateContinent, DEFAULT_CONTINENT, validateContinentSettings } from './continent.js';
import { containsPolygon } from './natural-geography.js';
import { previewContinent } from './world-planning.js';
import { validateAtlas } from './atlas.js';

test('different seeds change continental occupancy, not just edge jitter',()=>{
  const masks=['Pangaea','Avalon','Earth','rift','coast','test'].map(seed=>{
    const {rings}=generateContinent(seed);
    const mask=[];
    for(let y=-185;y<815;y+=25)for(let x=-195;x<1205;x+=25)mask.push(rings.reduce((n,r)=>n+Number(containsPolygon(r,x,y)),0)%2);
    return mask;
  });
  const differences=[];
  for(let i=0;i<masks.length;i++)for(let j=i+1;j<masks.length;j++) {
    let changed=0,union=0;for(let k=0;k<masks[i].length;k++){changed+=masks[i][k]!==masks[j][k];union+=Boolean(masks[i][k]||masks[j][k]);}
    differences.push(changed/union);
  }
  assert.ok(differences.reduce((a,b)=>a+b,0)/differences.length>.3,'Seeds must change at least 30% of their combined land on average');
});
test('drift and erosion alter deterministic coast geometry and record their process',()=>{
  const base=generateContinent('coast',{...DEFAULT_CONTINENT,drift:0,erosion:0});
  const drift=generateContinent('coast',{...DEFAULT_CONTINENT,drift:1,erosion:0});
  const erosion=generateContinent('coast',{...DEFAULT_CONTINENT,drift:1,erosion:1});
  assert.notDeepEqual(base.rings,drift.rings);assert.notDeepEqual(drift.rings,erosion.rings);
  assert.equal(erosion.history.erosion,1);assert.equal(erosion.history.drift,1);assert.ok(erosion.history.plateCount>=4);
  assert.throws(()=>validateContinentSettings({...DEFAULT_CONTINENT,drift:NaN}));
  assert.throws(()=>validateContinentSettings({...DEFAULT_CONTINENT,erosion:2}));
});
test('new coast version and process metadata round-trip without adding automatic biomes',()=>{
  const a={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const next=previewContinent(a,'w','Avalon',DEFAULT_CONTINENT).transaction.apply(a);
  assert.equal(next.worlds.w.generator.version,'2');assert.equal(next.worlds.w.fields,undefined);assert.deepEqual(next.worlds.w.biomes,{});
  assert.deepEqual(validateAtlas(JSON.parse(JSON.stringify(next))),next);
  const old=structuredClone(next);old.worlds.w.generator.version='1';delete old.worlds.w.landformHistory;
  assert.deepEqual(validateAtlas(old),old);
});
