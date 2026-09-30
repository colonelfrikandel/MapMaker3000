import {searchPlaces} from './atlas-search.js';

export function installAtlasSearch({button,getAtlas,focus}) {
  const dialog=document.createElement('dialog');dialog.id='atlas-search-dialog';dialog.setAttribute('aria-labelledby','atlas-search-title');
  dialog.innerHTML='<div class="dialog-top"><h2 id="atlas-search-title">Find a place</h2><button type="button" aria-label="Close place search">×</button></div><label class="generator-field">NAME OR NOTES<input type="search" placeholder="Village, tavern, landmark…" autocomplete="off" /></label><p role="status">Search across every map in your atlas.</p><div class="atlas-search-results"></div>';
  document.body.append(dialog);
  const input=dialog.querySelector('input'),results=dialog.querySelector('.atlas-search-results'),status=dialog.querySelector('[role=status]');
  function search() {
    const found=searchPlaces(getAtlas(),input.value);results.replaceChildren();
    status.textContent=!input.value.trim()?'Search across every map in your atlas.':found.length?`${found.length} results${found.length===30?' (showing the first 30)':''}.`:'No matching places.';
    for(const result of found) {
      const row=document.createElement('button');row.type='button';row.className='atlas-search-result';
      const name=document.createElement('strong'),detail=document.createElement('small');
      name.textContent=result.name;detail.textContent=`${result.type} · ${result.parent}`;row.append(name,detail);
      row.addEventListener('click',()=>{dialog.close();focus(result.id);});results.append(row);
    }
  }
  input.addEventListener('input',search);
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('button')?.focus();}if(event.key==='Enter'){event.preventDefault();results.querySelector('button')?.click();}});
  results.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp'].includes(event.key))return;
    event.preventDefault();const target=event.key==='ArrowDown'?event.target.nextElementSibling:event.target.previousElementSibling;
    (target||input).focus();
  });
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  button.addEventListener('click',()=>{input.value='';search();dialog.showModal();input.focus();});
}
