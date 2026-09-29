import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTownBase } from './town-generator.js';
import { townBaseSvg } from './town-base.js';
import { vegetationSvg } from './settlement-style.js';
import { artworkForBoard } from './cartography.js';
import { circleAnchors } from './biome-curves.js';

test('biome styles are deterministic and preserve every saved settlement footprint and feature',()=>{
  for(const kind of ['town','village']) {
    const base=generateTownBase(kind,'style-check'),before=structuredClone(base),outputs=[];
    for(const biome of ['forest','desert','snow','wetland','grassland','tundra','alpine']) {
      const context={surface:'land',biome},svg=townBaseSvg(base,context);
      assert.equal(svg,townBaseSvg(base,context));assert.match(svg,/settlement-edge/);outputs.push(svg);
      assert.deepEqual(base,before);
    }
    assert.equal(new Set(outputs).size,7);
    assert.equal(townBaseSvg(base),townBaseSvg(base,{surface:'land',biome:null}));
    assert.equal(townBaseSvg(base),townBaseSvg(base,{surface:'water',biome:'forest'}));
  }
});
test('desert vegetation is sparse, snow uses conifers and swamp uses reeds',()=>{
  const points=Array.from({length:32},(_,i)=>[i*10,50]);
  assert.equal((vegetationSvg(points,{surface:'land',biome:'desert'}).match(/<path/g)||[]).length,4);
  assert.match(vegetationSvg(points,{surface:'land',biome:'snow'}),/fill="#e6ebe2"/);
  assert.doesNotMatch(vegetationSvg(points,{surface:'land',biome:'wetland'}),/<circle/);
});
test('board rendering samples its parent site and responds to a moved settlement without changing notes',()=>{
  const board={id:'v',kind:'village',parentPlaceId:'p',placeIds:[],baseMap:generateTownBase('village','same')};
  const atlas={rootBoardId:'w',boards:{w:{id:'w',kind:'world',placeIds:['p']},v:board},places:{p:{id:'p',boardId:'w',type:'village',x:0,y:0,childBoardId:'v',notes:'Keep this history'}},routes:{},worlds:{w:{mode:'independent',geography:{c:{type:'coastline',points:circleAnchors(0,0,2000)}},biomes:{b:{id:'b',type:'forest',points:circleAnchors(76,49,100),priority:1,boundaryVersion:2}}}}};
  const before=structuredClone(atlas);assert.match(artworkForBoard(board,atlas),/settlement-edge-forest/);assert.deepEqual(atlas,before);
  atlas.places.p.x=600;assert.doesNotMatch(artworkForBoard(board,atlas),/settlement-edge-forest/);
  assert.equal(atlas.places.p.notes,'Keep this history');assert.deepEqual(board.baseMap,before.boards.v.baseMap);
});
