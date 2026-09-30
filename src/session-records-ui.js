import { saveSessionRecord } from './session-records.js';

export function installSessionRecords({button,getAtlas,apply,focus,review}) {
  const dialog=document.createElement('dialog');dialog.id='sessions-dialog';
  dialog.innerHTML=`<div class="dialog-top"><h2>Sessions</h2><button type="button" data-action="close">Close</button></div>
    <div class="session-toolbar"><select aria-label="Saved sessions" data-field="list"></select><button type="button" data-action="new">New session</button></div>
    <form><label>Title<input data-field="title" maxlength="120" required></label><label>Date<input data-field="date" type="date" required></label>
    <label>Starting location<select data-field="start"></select></label><div data-field="links"></div>
    <label>Notes<textarea data-field="notes" rows="4" maxlength="100000"></textarea></label>
    <label>Transcript (Dutch or English)<textarea data-field="transcript" rows="6" maxlength="200000"></textarea></label>
    <p>Text is stored as written. Saving a session does not change the map.</p>
    <label>Discoveries<textarea data-field="discoveries" rows="3" maxlength="100000" placeholder="What did the party discover?"></textarea></label>
    <fieldset><legend>Linked places</legend><p>Mark places visited or discovered. Use Open to return to the map.</p><div data-field="places"></div></fieldset>
    <p data-field="status" role="status"></p><button type="submit" class="primary-button">Save session</button><button type="submit" data-action="review">Save & review discoveries</button></form>`;
  document.body.append(dialog);
  const field=key=>dialog.querySelector(`[data-field="${key}"]`);
  let currentId=null,original=null;
  function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el;}
  function refreshList(){field('list').replaceChildren(option('','New session'));for(const s of Object.values(getAtlas().sessions).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))field('list').append(option(s.id,s.title||s.name||'Earlier session'));field('list').value=currentId||'';}
  function load(id) {
    currentId=id||null;original=id?getAtlas().sessions[id]:null;
    const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    for(const key of ['title','date','notes','transcript','discoveries'])field(key).value=original?.[key]??(key==='title'?original?.name||'':key==='date'?today:key==='transcript'?original?.sourceText||'':'');
    field('status').textContent='';field('start').replaceChildren(option('','Not set'));field('places').replaceChildren();field('links').replaceChildren();
    const places=Object.values(getAtlas().places).sort((a,b)=>a.name.localeCompare(b.name));
    const linked=new Set([original?.startPlaceId,...(original?.visitedPlaceIds||[]),...(original?.discoveryPlaceIds||[])]);
    for(const p of places){
      const label=p.name+' · '+(getAtlas().boards[p.boardId]?.name||p.type);field('start').append(option(p.id,label));
      const row=document.createElement('div');row.className='session-place-row';const name=document.createElement('span');name.textContent=label;row.append(name);
      for(const [key,text] of [['visitedPlaceIds','Visited'],['discoveryPlaceIds','Discovered']]){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.link=key;check.value=p.id;check.checked=original?.[key]?.includes(p.id)||false;label.append(check,document.createTextNode(text));row.append(label);}
      const open=document.createElement('button');open.type='button';open.textContent='Open';open.addEventListener('click',()=>{if(dialog.querySelector('form').dataset.dirty==='true'&&!confirm('Discard unsaved session edits and open this place?'))return;dialog.close();focus(p.id);});row.append(open);field('places').append(row);
    }
    for(const id of linked)if(id&&!getAtlas().places[id]){const p=document.createElement('p');p.textContent='Previously linked place is no longer on the map.';field('links').append(p);}
    if(original?.startPlaceId&&!getAtlas().places[original.startPlaceId])field('start').append(option(original.startPlaceId,'Unavailable starting location'));
    field('start').value=original?.startPlaceId||'';refreshList();dialog.querySelector('form').dataset.dirty='false';
    if(!places.length)field('places').textContent='Add places to the map to link them here.';
  }
  const form=dialog.querySelector('form');form.addEventListener('input',()=>form.dataset.dirty='true');
  function canLeave(){return form.dataset.dirty!=='true'||confirm('Discard unsaved session edits?');}
  dialog.addEventListener('cancel',event=>{if(!canLeave())event.preventDefault();});
  dialog.querySelector('[data-action="close"]').addEventListener('click',()=>{if(canLeave())dialog.close();});
  dialog.querySelector('[data-action="new"]').addEventListener('click',()=>{if(canLeave())load(null);});
  field('list').addEventListener('change',()=>{if(canLeave())load(field('list').value);else field('list').value=currentId||'';});
  button.addEventListener('click',()=>{load(null);dialog.showModal();});
  form.addEventListener('submit',event=>{
    event.preventDefault();try{
      const record={id:currentId||crypto.randomUUID(),startPlaceId:field('start').value||null};
      for(const key of ['title','date','notes','transcript','discoveries'])record[key]=field(key).value;
      for(const key of ['visitedPlaceIds','discoveryPlaceIds'])record[key]=[...(original?.[key]||[]).filter(id=>!getAtlas().places[id]),...[...dialog.querySelectorAll(`input[data-link="${key}"]:checked`)].map(el=>el.value)];
      apply(saveSessionRecord(getAtlas(),record));load(record.id);field('status').textContent='Session saved. You can undo this change from the map.';
      if(event.submitter?.dataset.action==='review'){dialog.close();review(record.id);}
    }catch(error){field('status').textContent=error.message;}
  });
}
