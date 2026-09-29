import { samplePlaceEnvironment } from './environment.js';
import { circleAnchors } from './biome-curves.js';
import { newBiome } from './biome-editor.js';

const BIOMES={forest:/\b(forest|woodland|woods)\b/i,desert:/\bdesert\b/i,snow:/\b(snowy|snow-covered|snow covered)\b/i,wetland:/\b(swamp|marsh|wetland)\b/i,grassland:/\b(grassland|prairie|meadow)\b/i,tundra:/\btundra\b/i,alpine:/\balpine\b/i};
export function suggestSessionChanges(atlas,placeId,source) {
  if(!atlas.places[placeId])throw new Error('Select an existing place.');
  const text=source.trim();
  if(!text||text.length>20000)throw new Error('Paste session text (up to 20,000 characters).');
  const context=samplePlaceEnvironment(atlas,placeId);
  const suggestions=[{id:'note',kind:'note',label:'Append this text to the place’s session notes',text},
    {id:'event',kind:'event',label:'Pin this text as a campaign event',text}];
  // Only unambiguous positive biome mentions; never infer spatial relationships
  // or resolve contradictions from a transcript with this keyword-only parser.
  const clauses=text.split(/[.!?;\n]+/).filter(Boolean);
  const matches=Object.entries(BIOMES).filter(([,pattern])=>clauses.some(s=>pattern.test(s)&&! /\b(not|never|no|isn't|wasn't|without|used to|leaving|left)\b/i.test(s)));
  if(context?.surface==='land'&&matches.length===1) {
    const [biome,pattern]=matches[0];
    suggestions.push({id:'biome',kind:'biome',biome,x:context.x,y:context.y,worldBoardId:context.worldBoardId,radius:60,
      label:`Add a ${biome==='wetland'?'swamp':biome} area around this place (radius 60 world units)`,
      text:clauses.find(s=>pattern.test(s)&&! /\b(not|never|no|isn't|wasn't|without|used to|leaving|left)\b/i.test(s)).trim()});
  }
  return suggestions;
}

export function applySessionSuggestions(atlas,{placeId,source,sessionName,selected,eventTitle='Session discovery',sessionId,biomeId,eventId,acceptedAt}) {
  const choices=suggestSessionChanges(atlas,placeId,source).filter(s=>selected.includes(s.id));
  if(!choices.length)throw new Error('Select at least one suggestion.');
  if(!sessionId||atlas.sessions?.[sessionId])throw new Error('Session identifier must be new.');
  const next=structuredClone(atlas),place=next.places[placeId];next.sessions ||= {};
  const provenance={kind:'session-suggestion',sessionId,sourceText:source.trim(),acceptedAt};
  next.sessions[sessionId]={id:sessionId,name:sessionName.trim()||'Session review',sourceText:source.trim(),acceptedAt,placeId,acceptedSuggestions:choices.map(c=>c.id)};
  for(const suggestion of choices) {
    if(suggestion.kind==='note') {
      place.notes=[place.notes,source.trim()].filter(Boolean).join('\n\n');
      (place.noteSources ||= []).push(structuredClone(provenance));
    }
    if(suggestion.kind==='event') {
      (place.events ||= []).push({id:eventId,title:eventTitle.trim().slice(0,120)||'Session discovery',detail:source.trim(),session:sessionName.trim().slice(0,80),provenance:structuredClone(provenance)});
    }
    if(suggestion.kind==='biome') {
      const world=next.worlds[suggestion.worldBoardId];
      const priority=1+Math.max(0,...Object.values(world.biomes).map(r=>r.priority||0));
      const region=newBiome(biomeId,suggestion.biome,circleAnchors(suggestion.x,suggestion.y,suggestion.radius),priority);
      Object.assign(region,{curved:true,boundaryVersion:2,provenance:{...provenance,sourceText:suggestion.text}});
      world.biomes[biomeId]=region;
    }
  }
  return next;
}
