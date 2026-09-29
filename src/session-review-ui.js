import { suggestSessionChanges, applySessionSuggestions } from './session-suggestions.js';
import { createPreview } from './editor.js';
import { validateAtlas } from './atlas.js';
import { artworkForBoard } from './cartography.js';

export function installSessionReview({button,getAtlas,getPlaceId,apply}) {
  const dialog=document.createElement('dialog');dialog.id='session-review';
  dialog.innerHTML='<h2>Review session text</h2><p data-role="target"></p><p>Simple keyword matching, not AI interpretation. All text refers to the selected place. Check each suggestion before applying; nothing is selected automatically.</p><label>Session name<input data-role="name" maxlength="80" placeholder="Session 12" /></label><label>Session text<textarea data-role="source" rows="6" maxlength="20000" placeholder="Paste the relevant passage for this place."></textarea></label><label>Event title<input data-role="title" maxlength="120" value="Session discovery" /></label><button data-action="review">Find suggestions</button><div data-role="choices"></div><div data-role="preview"></div><p data-role="status" role="status"></p><div class="generator-actions"><button data-action="cancel">Cancel</button><button data-action="apply" disabled>Apply selected changes</button></div>';
  document.body.append(dialog);
  const field=name=>dialog.querySelector(`[data-role="${name}"]`),action=name=>dialog.querySelector(`[data-action="${name}"]`);
  let placeId=null,transaction=null,sourceAtlas=null,ids=null;
  function invalidate(){transaction?.cancel();transaction=null;action('apply').disabled=true;field('preview').replaceChildren();}
  function resetReview(){invalidate();field('choices').replaceChildren();field('status').textContent='Find suggestions to review these edits.';}
  button.addEventListener('click',()=>{
    placeId=getPlaceId();if(!getAtlas().places[placeId])return;
    sourceAtlas=structuredClone(getAtlas());ids={sessionId:crypto.randomUUID(),eventId:crypto.randomUUID(),biomeId:crypto.randomUUID(),acceptedAt:new Date().toISOString()};
    field('target').textContent='For: '+sourceAtlas.places[placeId].name;
    field('source').value='';field('name').value='';field('title').value='Session discovery';resetReview();dialog.showModal();
  });
  for(const name of ['source','name','title'])field(name).addEventListener('input',resetReview);
  function preview() {
    invalidate();
    const selected=[...field('choices').querySelectorAll('input:checked')].map(el=>el.value);
    if(!selected.length){field('status').textContent='Select at least one change.';return;}
    try {
      const candidate=applySessionSuggestions(sourceAtlas,{placeId,source:field('source').value,sessionName:field('name').value,eventTitle:field('title').value,selected,...ids});
      transaction=createPreview(sourceAtlas,draft=>Object.assign(draft,candidate),validateAtlas);
      const summary=document.createElement('p');summary.textContent=`${selected.length} selected changes. Existing notes are kept. Applying saves the source passage and can be undone.`;field('preview').append(summary);
      if(selected.includes('biome')) {
        const suggestion=suggestSessionChanges(sourceAtlas,placeId,field('source').value).find(s=>s.kind==='biome');
        const grid=document.createElement('div');grid.className='session-map-comparison';
        for(const [label,atlas] of [['Before',sourceAtlas],['After',candidate]]) {
          const cell=document.createElement('div'),heading=document.createElement('strong'),map=document.createElement('div');heading.textContent=label;
          map.innerHTML=artworkForBoard(atlas.boards[suggestion.worldBoardId],atlas);cell.append(heading,map);grid.append(cell);
        }
        field('preview').append(grid);
      }
      field('status').textContent='Ready to apply your selected changes.';action('apply').disabled=false;
    }catch(error){field('status').textContent=error.message;}
  }
  action('review').addEventListener('click',()=>{
    resetReview();
    try {
      const suggestions=suggestSessionChanges(sourceAtlas,placeId,field('source').value);
      for(const suggestion of suggestions) {
        const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.value=suggestion.id;
        text.textContent=suggestion.label;label.className='session-choice';label.append(check,text);field('choices').append(label);check.addEventListener('change',preview);
        if(suggestion.kind==='biome'){const quote=document.createElement('blockquote');quote.textContent=suggestion.text;field('choices').append(quote);}
      }
      field('status').textContent='Choose the changes to accept. Unchecked suggestions will not be applied.';
    }catch(error){field('status').textContent=error.message;}
  });
  action('cancel').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',invalidate);
  action('apply').addEventListener('click',()=>{
    try{if(!transaction)return;apply(transaction.apply(getAtlas()));dialog.close();}catch(error){invalidate();field('status').textContent=error.message;}
  });
}
