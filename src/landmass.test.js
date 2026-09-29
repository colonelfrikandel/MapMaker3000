import test from 'node:test';
import assert from 'node:assert/strict';
import { softenInlets } from './landmass.js';

test('deep narrow inlet ends fill in while the broad mouth and outer land stay', () => {
  const nx=500,ny=440,field=new Float32Array(nx*ny);
  for(let y=0;y<ny;y++) for(let x=0;x<nx;x++) {
    const outer=Math.min(x-115,385-x,y-115,325-y);
    const halfWidth=Math.max(0,(310-x)*.5);
    field[y*nx+x]=Math.min(outer,x<310?Math.abs(y-220)-halfWidth:1000);
  }
  const original=field.slice();
  const closed=softenInlets(field,nx,ny,1);
  assert.ok(original[220*nx+270]<0);
  assert.ok(closed[220*nx+270]>0,'fill the narrow end rather than cutting far inland');
  assert.ok(closed[220*nx+135]<0,'keep the broad bay entrance open');
  assert.ok(closed[220*nx+370]>0,'retain inland ground');
  assert.ok(closed[220*nx+105]<0,'do not expand into the open sea');
  assert.equal(closed[140*nx+370],original[140*nx+370],'outer coast away from the inlet stays put');
});
