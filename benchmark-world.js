import { worldLandShape, worldSvg } from './src/world-generator.js';

// Informational timings, not pass/fail tests: results depend on the machine.
for (const [count,spacing] of [[4,260],[100,10000],[500,10000]]) {
  const columns=Math.ceil(Math.sqrt(count));
  const realms=Array.from({length:count},(_,i)=>({
    name:`Realm ${i}`,x:(i%columns)*spacing-500,y:Math.floor(i/columns)*spacing-500,
    radius:150,biome:'forest',
  }));
  const seed=`benchmark-${count}`,start=performance.now();
  const shape=worldLandShape(realms,seed),generated=performance.now();
  const svg=worldSvg(realms,seed),finished=performance.now();
  console.log(JSON.stringify({realms:count,worldWidth:Math.round(shape.bounds.width),
    geometryMs:+(generated-start).toFixed(1),svgMs:+(finished-generated).toFixed(1),
    samples:shape.samples,coastVertices:shape.landRings.flat().length,svgKB:Math.round(svg.length/1024)}));
}
