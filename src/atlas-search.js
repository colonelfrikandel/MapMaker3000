const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// Search campaign names and notes across every nested map, without copying or
// changing atlas objects. Parent names disambiguate repeated place names.
export function searchPlaces(atlas,query,limit=30) {
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
  if(!terms.length)return [];
  const results=[];
  for(const item of Object.values(atlas.places)) {
    const parent=atlas.boards[item.boardId];if(!parent)continue;
    const name=normalize(item.name),text=normalize([item.name,item.type,parent.name,item.description,item.notes].join(' '));
    if(!terms.every(term=>text.includes(term)))continue;
    const score=name===normalize(query).trim()?0:terms.every(t=>name.includes(t))?1:2;
    results.push({id:item.id,name:item.name||'Unnamed place',type:item.type,parent:parent.name||'Map',score});
  }
  return results.sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,limit);
}
