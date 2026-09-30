import Alea from './vendor/azgaar/alea.js';
import {createGrid} from './vendor/azgaar/grid.js';
import {createHeightmap} from './vendor/azgaar/heightmap.js';
import {heightmapTemplates} from './vendor/azgaar/templates.js';
import {sampleTerrainHeight} from './terrain-heightmap.js';

export const AZGAAR_TEMPLATES=Object.entries(heightmapTemplates).map(([id,t])=>({id,name:t.name}));
export const AZGAAR_REVISION='7940ee81c675befe784f047f92f212aaa031e38b';
// Keep upstream's ~10k jittered Voronoi cells and recipe operations. Resample
// the resulting heights only at the boundary to MapMaker's contour renderer.
export function azgaarField(seed,settings,nx,ny,step) {
  const width=1400,height=width*settings.height/settings.width,points=10000;
  const Grid=createGrid(),graph=Grid.generate(seed,width,height,points);
  const heights=createHeightmap(Alea(seed),Grid).fromTemplate(graph,settings.azgaarTemplate,{points,width,height});
  const field=new Float32Array(nx*ny),{cellsX,cellsY}=graph;
  const heightmap={version:1,nx:cellsX,ny:cellsY,values:Array.from(heights),seaLevel:20};
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const h=sampleTerrainHeight(heightmap,settings,settings.centerX-settings.width/2+x*step,settings.centerY-settings.height/2+y*step);
    // Upstream classifies cells >=20 as land; interpolate between 19 and 20.
    field[y*nx+x]=h-19.5;
  }
  for(let x=0;x<nx;x++)field[x]=field[(ny-1)*nx+x]=-1;
  for(let y=0;y<ny;y++)field[y*nx]=field[y*nx+nx-1]=-1;
  return {field,history:{version:4,backend:'azgaar',revision:AZGAAR_REVISION,template:settings.azgaarTemplate,cells:heights.length},
    heightmap};
}
