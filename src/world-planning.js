import { previewAtlasUpgrade, validateAtlas } from './atlas.js';
import { generateContinent, independentShape } from './continent.js';
import { mergeGeneratedLayer, createPreview, isProtected } from './editor.js';
import { worldSurfaceAt } from './world-generator.js';
import { worldRealms } from './cartography.js';
import { generateNaturalGeography } from './natural-geography.js';
import { prepareBiomes } from './smooth-regions.js';
import { blankAtlas } from './blank-atlas.js';

export function previewContinent(atlas,boardId,seed,settings,options={}) {
  if(atlas.boards[boardId]?.kind!=='world') throw new Error('Select a world map');
  if(typeof seed!=='string'||!seed.trim()||seed.length>200) throw new Error('Enter a geography seed (up to 200 characters).');
  if(options.cleanWorld && boardId!==atlas.rootBoardId)throw new Error('Start a clean world from the root map.');
  const keepCoastline=!options.cleanWorld && options.keepCoastline && atlas.worlds?.[boardId]?.mode==='independent';
  const terrain=keepCoastline?{rings:[],samples:0}:generateContinent(seed,settings);
  const transaction=createPreview(atlas,draft=>{
    if(options.cleanWorld){for(const key of Object.keys(draft))delete draft[key];Object.assign(draft,blankAtlas(boardId));}
    if(draft.schemaVersion===1) Object.assign(draft,previewAtlasUpgrade(draft).atlas);
    const world=draft.worlds[boardId];
    const generated=Object.fromEntries(terrain.rings.map((points,i)=>{
      const id=`coastline-${i}`;
      return [id,{id,type:'coastline',points,editState:'generated',protected:false,provenance:{kind:'generator',seed,generatorVersion:`continent-${settings.shapeVersion||2}`}}];
    }));
    const other=Object.fromEntries(Object.entries(world.geography).filter(([,item])=>item.type!=='coastline'));
    const coasts=Object.fromEntries(Object.entries(world.geography).filter(([,item])=>item.type==='coastline'));
    if(!keepCoastline) world.geography={...other,...mergeGeneratedLayer(coasts,generated)};
    world.mode='independent';if(!keepCoastline){world.generator={name:'continent',version:String(settings.shapeVersion||2)};world.landformHistory=terrain.history;}
    if(!keepCoastline) {world.seed=seed;world.settings=structuredClone(settings);}
    if(!keepCoastline) {
      if(terrain.heightmap)world.terrainHeightmap=terrain.heightmap;
      else delete world.terrainHeightmap;
    }
    if(options.natural||options.physical) {
      const natural=generateNaturalGeography(world,seed,{biomes:!options.physical});
      const existing=Object.fromEntries(Object.entries(world.geography).filter(([,g])=>['river','lake','mountain'].includes(g.type)));
      const otherLayers=Object.fromEntries(Object.entries(world.geography).filter(([,g])=>!['river','lake','mountain'].includes(g.type)));
      world.geography={...otherLayers,...mergeGeneratedLayer(existing,natural.geography)};
      world.biomes=mergeGeneratedLayer(world.biomes,natural.biomes);
      for(const id of world.biomeDeletions||[])delete world.biomes[id];
      if(Object.values(world.biomes).some(isProtected))world.biomes=prepareBiomes(world.biomes,natural.fields.step,{preserveProtected:true});
      world.fields=natural.fields;
    } else {
      // Land-only generation removes automatic terrain; explicit user edits remain.
      delete world.fields;
      world.geography=Object.fromEntries(Object.entries(world.geography).filter(([,g])=>!['river','lake','mountain'].includes(g.type)||isProtected(g)));
      world.biomes=mergeGeneratedLayer(world.biomes,{});
    }
  },validateAtlas);
  const shape=independentShape(transaction.candidate.worlds[boardId]);
  const offshore=worldRealms(transaction.candidate.boards[boardId],transaction.candidate).filter(r=>worldSurfaceAt(shape,r.x,r.y).kind==='water');
  return {transaction,offshore:offshore.map(r=>r.name),samples:terrain.samples};
}
