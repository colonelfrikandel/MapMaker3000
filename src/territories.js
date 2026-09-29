import { validateBiomePolygon } from './biome-editor.js';

export function territoryColor(realmId) {
  const colors=['#b44239','#3869ac','#79509a','#258879','#bd852e','#a84e7a'];
  let hash=0;for(const char of realmId)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return colors[hash%colors.length];
}
export function territorySvg(world) {
  if(world.showTerritories===false)return '';
  const path=points=>'M'+points.map(p=>p.map(v=>Math.round(v*100)/100).join(' ')).join('L')+'Z';
  return Object.values(world.territories).sort((a,b)=>(a.priority??0)-(b.priority??0)||a.id.localeCompare(b.id)).map(region=>
    `<path d="${[path(region.points),...(region.holes||[]).map(path)].join('')}" fill="${territoryColor(region.realmId)}" fill-opacity=".1" fill-rule="evenodd" stroke="${territoryColor(region.realmId)}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="7 3"/>`).join('');
}
export function assignTerritory(region,realmId,atlas,worldId) {
  if(atlas.places[realmId]?.type!=='continent'||atlas.places[realmId]?.boardId!==worldId)throw new Error('Choose a realm on this world map.');
  return validateBiomePolygon({...structuredClone(region),type:'territory',realmId,editState:'manually-edited',protected:true});
}
