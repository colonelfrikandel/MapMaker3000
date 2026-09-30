// Development-only conversion of the reviewed upstream files at the revision
// documented in src/vendor/azgaar/README.md. Run with Node 24 and source folder.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
const input=process.argv[2],out=new URL('../src/vendor/azgaar/',import.meta.url);
mkdirSync(out,{recursive:true});
const read=name=>readFileSync(join(input,name),'utf8');
const notice='// Adapted from Azgaar Fantasy Map Generator, MIT, Copyright 2017-2024 Max Haniyeu.\n// Revision 7940ee81c675befe784f047f92f212aaa031e38b. See LICENSE and README.md.\n';
const write=(name,s)=>writeFileSync(new URL(name,out),s);
const strip=s=>stripTypeScriptTypes(s,{mode:'strip'});
let templates=read('heightmap-templates.ts');
templates=templates.slice(0,templates.indexOf('declare global'));
write('templates.js',notice+strip(templates));
let height=read('heightmap-generator.ts');
height=height.slice(height.indexOf('class HeightmapModule'),height.indexOf('  /** heightmap template'))+
  height.slice(height.indexOf('  fromTemplate('),height.indexOf('  private getHeightsFromImageData'))+'}\n';
height=height.replaceAll(' = options.map.graph','').replaceAll('Math.random()','random()').replaceAll('window.ERROR','false');
// Bound upstream random walks; malformed/unlucky graphs cannot hang a preview.
height=height.replaceAll('while (cur !== end) {','for (let walk = 0; cur !== end && walk < this.grid.points.length * 4; walk++) {');
write('heightmap.js',notice+`import {heightmapTemplates} from './templates.js';
import {numericHelpers,mean,leastIndex,d3Range,lim} from './helpers.js';
export function createHeightmap(random,Grid) {
const {getNumberInRange,P,rand}=numericHelpers(random);
${strip(height)}
return new HeightmapModule();
}
`);
let voronoi=read('voronoi.ts');
voronoi=voronoi.slice(voronoi.indexOf('export type Vertices'));
voronoi=voronoi.replaceAll('TIME && console.time','false && console.time');
write('voronoi.js',notice+"import Delaunator from './delaunator.js';\n"+strip(voronoi));
let grid=read('grid-generator.ts');
const generate=grid.slice(grid.indexOf('  generate('),grid.indexOf('  /**\n   * rebuild'));
const find=grid.slice(grid.indexOf('  findCell('),grid.indexOf('  /** cell indexes'));
const methods=grid.slice(grid.indexOf('  /** distance between points'),grid.indexOf('  /** turn depressions'));
let body='class GridModule {\n'+generate+find+methods+'}\n';
body=body.replaceAll(' = this.getCellsDesired()',' = 10000').replaceAll(' = grid','')
  .replace('Math.random = Alea(seed);','random = Alea(seed);').replaceAll('Math.random()','random()')
  .replaceAll('TIME && console.time','false && console.time')
  .replace('this.resetHeights(graph);','graph.cells.h = new Uint8Array(graph.points.length);');
write('grid.js',notice+`import Alea from './alea.js';
import {calculateVoronoi} from './voronoi.js';
const rn=(v,d=0)=>Math.round(v*10**d)/10**d;
export function createGrid() {
let random;
${strip(body)}
return new GridModule();
}
`);
for(const [name,start] of [['alea.js','  \'use strict\';'],['delaunator.js',"'use strict';"]]) {
  let s=read(name);s=s.slice(s.indexOf(start)+start.length,s.lastIndexOf('}));'));
  write(name,'// '+name+' pinned dependency. See adjacent license. UMD wrapper converted to ESM.\nconst value=(()=>{\n'+s+'\n})();\nexport default value;\n');
}
for(const name of ['LICENSE','alea.LICENSE','delaunator.LICENSE'])write(name,read(name));
