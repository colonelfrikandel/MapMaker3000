import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPlaces} from './atlas-search.js';
import {naturalSvg} from './natural-geography.js';
import {previewContinent} from './world-planning.js';
import {DEFAULT_CONTINENT} from './continent.js';
import {serializeAtlas,validateAtlas} from './atlas.js';

test('place search finds nested names and notes, ignores accents, and distinguishes duplicate names',()=>{
  const atlas={boards:{w:{name:'World'},v:{name:'Brackenford'}},places:{
    a:{id:'a',boardId:'w',type:'village',name:'Haven',notes:'The party travelled west'},
    b:{id:'b',boardId:'v',type:'house',name:'Haven',description:'A tavern'},
    c:{id:'c',boardId:'v',type:'house',name:'Café',notes:'Old stone bridge'},
  }};
  const before=structuredClone(atlas);
  assert.equal(searchPlaces(atlas,'haven').length,2);
  assert.deepEqual(searchPlaces(atlas,'haven brackenford').map(r=>r.id),['b']);
  assert.deepEqual(searchPlaces(atlas,'CAFE').map(r=>r.id),['c']);
  assert.deepEqual(searchPlaces(atlas,'stone bridge').map(r=>r.id),['c']);
  assert.deepEqual(searchPlaces(atlas,'party west').map(r=>r.id),['a']);
  assert.deepEqual(searchPlaces(atlas,'missing'),[]);
  assert.deepEqual(searchPlaces(atlas,'  '),[]);
  assert.equal(searchPlaces(atlas,'haven',1).length,1);
  assert.deepEqual(atlas,before);
});

test('world layers hide artwork while preserving editable features and save/load',()=>{
  const a={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const atlas=previewContinent(a,'w','test',DEFAULT_CONTINENT,{natural:true}).transaction.apply(a);
  const w=atlas.worlds.w,before=structuredClone(w);
  assert.match(naturalSvg(w),/#6b9aab/);
  w.showPhysical=false;w.showBiomes=false;
  const hidden=naturalSvg(w);
  assert.doesNotMatch(hidden,/#6b9aab|#8babb2|#d6d4b8|tree-test\.png/);
  assert.deepEqual(w.geography,before.geography);
  assert.deepEqual(w.biomes,before.biomes);
  assert.deepEqual(w.fields,before.fields);
  const loaded=validateAtlas(JSON.parse(serializeAtlas(atlas)));
  assert.equal(loaded.worlds.w.showBiomes,false);assert.equal(loaded.worlds.w.showPhysical,false);
  w.showPhysical=true;w.showBiomes=true;
  assert.equal(naturalSvg(w),naturalSvg(before));
  w.showPhysical='false';assert.throws(()=>validateAtlas(atlas),/visibility/);
});
