import test from 'node:test';
import assert from 'node:assert/strict';
import { worldLandShape, worldSvg, worldSurfaceAt, coastlinesSeparated, worldIslandConflicts, ISLAND_WATER_GAP } from './world-generator.js';
import { MAX_TERRAIN_SAMPLES } from './landmass.js';

const realms = [
  { name:'Kemeia', x:240, y:315, radius:150, biome:'forest' },
  { name:'Idrieland', x:500, y:245, radius:150, biome:'snow' },
  { name:'Emerald Bay', x:745, y:350, radius:150, biome:'plains' },
  { name:'Crieta', x:825, y:89, radius:65, biome:'forest', island:true },
];

test('neighboring mainland realms share one rounded coastline and islands remain separate', () => {
  const shape = worldLandShape(realms, 'test seed');
  assert.ok(shape.land.length>500);
  assert.equal(shape.islands.length, 1);
  for (const [x,y] of [...shape.land,...shape.islands.flat()]) {
    assert.ok(x>shape.bounds.x && x<shape.bounds.x+shape.bounds.width);
    assert.ok(y>shape.bounds.y && y<shape.bounds.y+shape.bounds.height);
  }
  assert.equal(worldLandShape(realms.map(r=>({ ...r, island:false })), 'test seed').islands.length, 0);
});

test('island separation handles containment, crossing edges, touching and narrow channels', () => {
  const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const land=box(0,0,100,100);
  assert.equal(coastlinesSeparated(land,box(30,30,10,10)),false);
  assert.equal(coastlinesSeparated(box(0,40,100,20),box(40,0,20,100)),false);
  assert.equal(coastlinesSeparated(land,box(100,0,10,10)),false);
  assert.equal(coastlinesSeparated(land,box(100+ISLAND_WATER_GAP-1,0,10,10)),false);
  assert.equal(coastlinesSeparated(land,box(100+ISLAND_WATER_GAP+1,0,10,10)),true);
  assert.equal(coastlinesSeparated([],land),true);
});

test('offshore islands retain a real water gap across seeds without moving realm positions', () => {
  const original=structuredClone(realms);
  for (let i=0;i<100;i++) {
    const shape=worldLandShape(realms,`coast-${i}`);
    const island=shape.islands[0];
    for(let j=0;j<island.length;j+=8) {
      const a=island[j],b=island[(j+1)%island.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const surface=worldSurfaceAt(shape,(a[0]+b[0])/2+dy/length*10,(a[1]+b[1])/2-dx/length*10);
      assert.notEqual(surface.kind,'mainland',`water band at seed ${i}`);
    }
    assert.deepEqual(worldIslandConflicts(realms,`coast-${i}`),[]);
  }
  assert.deepEqual(realms,original);
});

test('inland islands are allowed while overlapping islands are reported', () => {
  assert.deepEqual(worldIslandConflicts([
    {name:'Mainland',x:500,y:315,radius:180},
    {name:'Inland island',x:500,y:315,radius:65,island:true},
  ]),[]);
  assert.ok(worldIslandConflicts([
    {name:'One',x:400,y:315,radius:65,island:true},
    {name:'Two',x:410,y:315,radius:65,island:true},
  ]).some(message=>message.includes('One') && message.includes('Two')));
});

test('inland islands have surrounding lake water and keep their own terrain', () => {
  const inland=[
    {name:'Mainland',x:500,y:315,radius:180,biome:'desert'},
    {name:'Lake island',x:500,y:315,radius:65,island:true,biome:'forest'},
  ];
  for (let seed=0;seed<20;seed++) {
    const shape=worldLandShape(inland,`lake-${seed}`);
    assert.equal(worldSurfaceAt(shape,500,315).kind,'island');
    let waterSamples=0;
    // Walk out from the island center in every direction. The first
    // non-island samples must be water before reaching mainland again.
    for (let angle=0;angle<Math.PI*2;angle+=Math.PI/16) {
      let reachedWater=false,reachedLand=false,waterWidth=0;
      for (let radius=1;radius<260;radius++) {
        const surface=worldSurfaceAt(shape,500+Math.cos(angle)*radius,315+Math.sin(angle)*radius);
        if (surface.kind==='water') { reachedWater=true; waterWidth++; }
        if (surface.kind==='mainland') {
          assert.ok(reachedWater && waterWidth>=ISLAND_WATER_GAP,'lake must separate island from mainland');
          reachedLand=true; break;
        }
      }
      assert.ok(reachedLand,'inland lake should have a surrounding mainland shore');
      waterSamples+=waterWidth;
    }
    assert.ok(waterSamples>0);
  }
  const svg=worldSvg(inland,'lake');
  assert.match(svg,/mask="url\(#world-main-water-/);
  assert.match(svg,/stroke-width="44"/);
  assert.match(svg,/world-island-.*-0/);
  assert.deepEqual(worldIslandConflicts(inland,'lake'),[]);
});

test('islands touching the coast create water channels without a mainland conflict', () => {
  const coastal=[{name:'Mainland',x:500,y:315,radius:180},
    {name:'Coastal island',x:640,y:315,radius:65,island:true}];
  assert.deepEqual(worldIslandConflicts(coastal,'channel'),[]);
  assert.equal(worldSurfaceAt(worldLandShape(coastal,'channel'),640,315).kind,'island');
});

test('empty and island-only worlds work; renaming realms leaves geography unchanged', () => {
  assert.deepEqual(worldLandShape([]).land,[]);
  assert.deepEqual(worldLandShape([]).islands,[]);
  const archipelago=[{name:'West',x:180,y:300,radius:65,island:true},{name:'East',x:800,y:300,radius:65,island:true}];
  assert.equal(worldLandShape(archipelago).land.length,0);
  assert.deepEqual(worldIslandConflicts(archipelago),[]);
  assert.deepEqual(worldLandShape(realms,'same'),worldLandShape(realms.map(r=>({...r,name:'Renamed'})),'same'));
});

test('coastlines have bays and peninsulas, stay finite, and do not cross themselves', () => {
  function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  for (let seed=0;seed<20;seed++) {
    const {land,islands}=worldLandShape(realms,`shape-${seed}`);
    for (const polygon of [land,...islands]) {
      let concave=0,convex=0;
      for (let i=0;i<polygon.length;i++) {
        const a=polygon[i],b=polygon[(i+1)%polygon.length],c=polygon[(i+2)%polygon.length];
        assert.ok(a.every(Number.isFinite));
        if (cross(a,b,c)>0) convex++; else concave++;
        for (let j=i+2;j<polygon.length;j++) {
          if (i===0 && j===polygon.length-1) continue;
          const d=polygon[j],e=polygon[(j+1)%polygon.length];
          assert.ok(!(cross(a,b,d)*cross(a,b,e)<0 && cross(d,e,a)*cross(d,e,b)<0),'self-intersecting coastline');
        }
      }
      assert.ok(concave>10 && convex>10,'expected concave bays and convex headlands');
    }
  }
});

test('world seed changes coast and details while biomes blend through gradients', () => {
  assert.deepEqual(worldLandShape(realms,'same'),worldLandShape(realms,'same'));
  assert.notDeepEqual(worldLandShape(realms,'same').land,worldLandShape(realms,'other').land);
  const svg=worldSvg(realms,'same');
  assert.match(svg,/world-main-clip/);
  assert.match(svg,/world-islands-clip/);
  assert.match(svg,/#dbe0d5/);
  assert.match(svg,/#a9b685/);
  assert.ok(svg.length<500000);
});

test('worlds extend in every direction without squeezing realm centers into a rectangle', () => {
  const expanded=realms.map((r,i)=>({...r,x:r.x-6000+i*3500,y:r.y-4500+i*2300}));
  const shape=worldLandShape(expanded,'wide-world');
  assert.ok(shape.bounds.x<-5000 && shape.bounds.y<-4000);
  assert.ok(shape.bounds.x+shape.bounds.width>5000);
  for(const r of expanded) assert.equal(worldSurfaceAt(shape,r.x,r.y).kind,r.island?'island':'mainland');
  assert.ok(shape.samples<=MAX_TERRAIN_SAMPLES);
  const svg=worldSvg(expanded,'wide-world');
  assert.ok(!svg.includes('NaN'));
  assert.ok(svg.length<1000000);
});

test('large sparse worlds keep sampling and generated geometry bounded', () => {
  const expanded=Array.from({length:100},(_,i)=>({name:`Realm ${i}`,x:(i%10)*10000-50000,y:Math.floor(i/10)*10000-50000,radius:150}));
  const shape=worldLandShape(expanded,'large-atlas');
  assert.ok(shape.samples<=MAX_TERRAIN_SAMPLES);
  assert.ok(shape.landRings.flat().length<30000);
  for(const r of expanded) assert.equal(worldSurfaceAt(shape,r.x,r.y).kind,'mainland');
});
