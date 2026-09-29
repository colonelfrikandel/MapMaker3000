import test from 'node:test';
import assert from 'node:assert/strict';
import { circleAnchors, biomeGeometry, curvePoint } from './biome-curves.js';
import { newBiome, editBiome, biomeAtPoint } from './biome-editor.js';
import { displayedBiomes } from './smooth-regions.js';
import { previewContinent } from './world-planning.js';
import { DEFAULT_CONTINENT } from './continent.js';
import { validateAtlas } from './atlas.js';

test('circle keeps four editable anchors while its curved edge is selectable and insertable',()=>{
  const circle={...newBiome('circle','forest',circleAnchors(0,0,100)),curved:true,boundaryVersion:2};
  const shape=biomeGeometry(circle);
  assert.equal(circle.points.length,4);
  for(const p of shape.points)assert.ok(Math.abs(Math.hypot(...p)-100)<.03);
  assert.equal(biomeAtPoint({circle},65,65)?.id,'circle');
  const inserted=editBiome(circle,{kind:'insert',index:0,point:curvePoint(circle.points,0,.5)});
  assert.equal(inserted.points.length,5);
  const moved=editBiome(inserted,{kind:'vertex',index:1,point:[90,-90]});
  assert.deepEqual(moved.points[1],[90,-90]);
  displayedBiomes({biomes:{circle:moved}});
  assert.equal(moved.points.length,5);
  assert.equal(circle.points.length,4);
});

test('land-only generation removes automatic terrain and preserves manually dropped circles',()=>{
  const initial={schemaVersion:1,rootBoardId:'w',boards:{w:{id:'w',kind:'world',name:'World',placeIds:[]}},places:{},routes:{},sessions:{}};
  const automatic=previewContinent(initial,'w','before',DEFAULT_CONTINENT,{natural:true}).transaction.apply(initial);
  automatic.worlds.w.biomes.circle={...newBiome('circle','wetland',circleAnchors(0,0,100)),curved:true,boundaryVersion:2};
  const next=previewContinent(automatic,'w','after',DEFAULT_CONTINENT,{keepCoastline:true}).transaction.apply(automatic);
  assert.equal(next.worlds.w.fields,undefined);
  assert.ok(Object.values(next.worlds.w.geography).every(g=>g.type==='coastline'));
  assert.deepEqual(Object.keys(next.worlds.w.biomes),['circle']);
  assert.deepEqual(validateAtlas(JSON.parse(JSON.stringify(next))).worlds.w.biomes.circle,automatic.worlds.w.biomes.circle);
});
