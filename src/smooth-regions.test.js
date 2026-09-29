import test from 'node:test';
import assert from 'node:assert/strict';
import clip from './polygon-ops.js';
import { prepareBiomes, simplifyRing, visibleHandles, displayedBiomes } from './smooth-regions.js';
import { validateBiomePolygon } from './biome-editor.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { naturalSvg } from './natural-geography.js';

const box=(id,type,x,priority=0)=>({id,type,priority,points:[[x,0],[x+100,0],[x+100,100],[x,100]],holes:[],editState:'generated',protected:false,provenance:{kind:'generator'}});
const polygon=r=>[r.points,...(r.holes||[])];
const area=multi=>multi.reduce((sum,p)=>sum+Math.abs(p[0].reduce((s,a,i)=>{const b=p[0][(i+1)%p[0].length];return s+a[0]*b[1]-b[0]*a[1];},0)/2),0);

test('same-biome neighbors merge and different-biome areas do not overlap',()=>{
  const input={a:box('a','grassland',0),b:box('b','grassland',80),c:box('c','wetland',150,1)};
  const before=structuredClone(input),output=prepareBiomes(input,5);
  assert.deepEqual(input,before);
  assert.equal(Object.values(output).filter(r=>r.type==='grassland').length,1);
  const regions=Object.values(output);
  for(let i=0;i<regions.length;i++) {
    validateBiomePolygon(regions[i]);
    for(let j=0;j<i;j++)assert.ok(area(clip.intersection(polygon(regions[i]),polygon(regions[j])))<1e-6);
  }
});
test('dense grid-like rings become sparse outlines and screen handles stay bounded',()=>{
  const points=Array.from({length:400},(_,i)=>{const a=i*Math.PI/200;return [Math.round(Math.cos(a)*100),Math.round(Math.sin(a)*100)];});
  const sparse=simplifyRing(points,2);assert.ok(sparse.length<40);
  assert.ok(visibleHandles([points],1).length<=48);
  const selected={ring:0,index:71};assert.ok(visibleHandles([points],1,selected).some(h=>h.index===71));
});
test('display cleanup is non-mutating and rendered transitions include smooth water and mountain art',()=>{
  const source={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const world=previewContinent(source,'w','test',DEFAULT_CONTINENT,{natural:true}).transaction.candidate.worlds.w;
  const before=structuredClone(world),regions=Object.values(displayedBiomes(world));
  for(let i=0;i<regions.length;i++)for(let j=0;j<i;j++)assert.ok(area(clip.intersection(polygon(regions[i]),polygon(regions[j])))<1e-5);
  const svg=naturalSvg(world);assert.match(svg,/feGaussianBlur/);assert.match(svg,/Q/);assert.doesNotMatch(svg,/fill="#6d736a"/);
  assert.deepEqual(world,before);
});
