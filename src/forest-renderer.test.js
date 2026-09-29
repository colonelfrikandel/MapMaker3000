import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeTrees, forestSvg } from './forest-renderer.js';

const rectangle=[[0,0],[300,0],[300,200],[0,200]];
test('edge trees use upper/back and lower/front boundaries and skip vertical edges',()=>{
  const trees=edgeTrees(rectangle);
  assert.ok(trees.some(t=>t.layer==='back'));assert.ok(trees.some(t=>t.layer==='front'));
  assert.ok(trees.every(t=>t.angle<=60));
  assert.ok(trees.filter(t=>t.y===0).every(t=>t.layer==='back'));
  assert.ok(trees.filter(t=>t.y===200).every(t=>t.layer==='front'));
  assert.ok(trees.every(t=>!(t.x===0||t.x===300)||t.y<10||t.y>190));
  const reversed=edgeTrees([...rectangle].reverse());
  assert.ok(reversed.filter(t=>t.y===0).every(t=>t.layer==='back'));
  const hole=edgeTrees(rectangle,true);
  assert.ok(hole.filter(t=>t.y===0).every(t=>t.layer==='front'));
  assert.ok(hole.filter(t=>t.y===200).every(t=>t.layer==='back'));
});
test('four drawing layers use supplied PNGs and keep source geometry unchanged',()=>{
  const region={points:rectangle,holes:[[[100,60],[180,60],[180,120],[100,120]]]},before=structuredClone(region);
  const svg=forestSvg([region],{},'test');
  assert.deepEqual([...svg.matchAll(/data-forest-layer="(.*?)"/g)].map(m=>m[1]),['back','fill','interior','front']);
  assert.match(svg,/tree-test.png/);assert.match(svg,/tree-tops-test.png/);assert.match(svg,/fill="#555a48" fill-rule="evenodd"/);
  assert.equal(svg,forestSvg([region],{},'test'));assert.deepEqual(region,before);
  assert.ok((svg.split('data-forest-layer="interior"')[1].split('</g>')[0].match(/<image/g)||[]).length<=6);
});
test('angle setting changes edge coverage and merged adjacent forests have no internal tree seam',()=>{
  const diamond=[[0,100],[100,0],[200,100],[100,200]];
  assert.equal(edgeTrees(diamond,false,{maxAngle:20}).length,0);
  assert.ok(edgeTrees(diamond,false,{maxAngle:60}).length>0);
  const a={points:[[0,0],[150,0],[150,200],[0,200]]},b={points:[[150,0],[300,0],[300,200],[150,200]]};
  assert.equal(forestSvg([a,b]),forestSvg([{points:rectangle}]));
});
