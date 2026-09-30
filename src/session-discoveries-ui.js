import { proposeDiscoveries, discoveryDraft, applyDiscoveries, sessionSource, DISCOVERY_TYPES } from './session-discoveries.js';
import { artworkForBoard, worldRealms } from './cartography.js';
import { worldLandShape } from './world-generator.js';
import { cardSize } from './geometry.js';

export function installDiscoveryReview({getAtlas,apply}) {
  const dialog=document.createElement('dialog');dialog.id='discovery-review';
  dialog.innerHTML=`<div class="dialog-top"><h2>Review session discoveries</h2><button data-action="close">Close</button></div>
    <p>Local Dutch/English text rules suggest possible discoveries. They do not understand the full story. Review the source, edit each proposal, and choose Accept or Reject. Nothing is accepted automatically.</p>
    <p data-role="session"></p><div data-role="map" class="discovery-map"></div><p data-role="position" role="status">Choose “Position on map” on a place or biome, then click the map. You can also enter coordinates.</p>
    <div class="session-toolbar"><button data-add="place">Add place</button><button data-add="biome">Add biome</button><button data-add="route">Add route</button><button data-add="event">Add event</button><button data-action="scan">Find more suggestions</button></div>
    <div data-role="cards"></div><p data-role="status" role="status"></p><button class="primary-button" data-action="apply">Apply accepted / save review</button>`;
  document.body.append(dialog);
  const role=k=>dialog.querySelector(`[data-role="${k}"]`);
  let sessionId,proposals=[],selected=null,dirty=false,baseline;
  function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
  function placeOptions(){return [...Object.values(getAtlas().places).map(p=>['place:'+p.id,p.name+' · '+getAtlas().boards[p.boardId].name]),...proposals.filter(p=>p.kind==='place'&&(p.status==='accepted'||(p.status==='applied'&&getAtlas().places[p.resultId]))).map(p=>['proposal:'+p.id,p.name+(p.status==='applied'?' (session discovery)':' (accepted new place)')])];}
  function updateReferences(){for(const el of role('cards').querySelectorAll('select[data-reference]')){const p=proposals.find(p=>p.id===el.dataset.proposal),key=el.dataset.reference;el.replaceChildren(option('','Choose a place'),...placeOptions().map(([id,name])=>option(id,name)));el.value=p[key];}}
  function drawMap(){
    const atlas=getAtlas(),root=atlas.boards[atlas.rootBoardId];role('map').innerHTML=artworkForBoard(root,atlas);
    const svg=role('map').firstElementChild;if(!svg)return;
    const bounds=worldLandShape(worldRealms(root,atlas),root.worldSeed||root.name,atlas.worlds?.[root.id]).bounds;
    svg.setAttribute('viewBox',`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    function mark(x,y,name,radius,color){const ns='http://www.w3.org/2000/svg',circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',radius);circle.setAttribute('fill',color);circle.setAttribute('fill-opacity','.45');circle.setAttribute('stroke',color);svg.append(circle);const text=document.createElementNS(ns,'text');text.setAttribute('x',x+8);text.setAttribute('y',y-8);text.setAttribute('font-size',Math.max(12,bounds.width/65));text.textContent=name;svg.append(text);}
    for(const p of Object.values(atlas.places).filter(p=>p.boardId===root.id)){const [w,h]=cardSize(p.type);mark(p.x+w/2,p.y+h/2,p.name,5,'#334c55');}
    for(const p of proposals)if(['place','biome'].includes(p.kind)&&['pending','accepted'].includes(p.status)&&Number.isFinite(p.x)&&Number.isFinite(p.y))mark(p.x,p.y,p.name,p.kind==='biome'?p.radius:7,p.id===selected?'#c4492c':'#296854');
    svg.addEventListener('click',event=>{const p=proposals.find(p=>p.id===selected);if(!p)return;const transform=svg.getScreenCTM();if(!transform)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());p.x=Math.round(point.x);p.y=Math.round(point.y);dirty=true;selected=null;renderCards();drawMap();role('position').textContent='Position set for '+p.name+'. Choose Accept when ready.';});
  }
  function renderCards(){
    role('cards').replaceChildren();
    if(!proposals.length)role('cards').textContent='No suggestions found. Try a phrase such as: We reached the village "Oakvale". Or add a proposal manually.';
    for(const p of proposals){
      const card=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=p.kind.toUpperCase()+' · '+(p.name||'New discovery');card.append(legend);
      if(p.status==='applied'){const info=document.createElement('p');info.textContent='Applied: '+p.name;card.append(info);role('cards').append(card);continue;}
      function input(key,label,values=null,type='text'){
        const wrap=document.createElement('label');wrap.append(document.createTextNode(label));let el;
        if(values){el=document.createElement('select');for(const [id,text] of values)el.append(option(id,text));}
        else if(key==='detail'){el=document.createElement('textarea');el.rows=3;el.maxLength=200000;}
        else{el=document.createElement('input');el.type=type;if(type==='text')el.maxLength=120;if(type==='number')el.step='any';}
        el.value=p[key]??'';el.addEventListener('input',()=>{p[key]=type==='number'?(el.value===''?null:Number(el.value)):el.value;dirty=true;if(['name','status'].includes(key))updateReferences();if(['x','y','radius','name','status'].includes(key))drawMap();});wrap.append(el);card.append(wrap);return el;
      }
      input('status','Decision',[['pending','Review later'],['accepted','Accept'],['rejected','Reject']]);input('name','Name / title');
      input('type','Type',DISCOVERY_TYPES[p.kind].map(t=>[t,t]));input('detail','Description / event details');
      const source=document.createElement('blockquote');source.textContent=p.source||'Manually added proposal';card.append(source);
      if(['place','biome'].includes(p.kind)){
        const pick=document.createElement('button');pick.type='button';pick.textContent='Position on map';pick.addEventListener('click',()=>{selected=p.id;role('position').textContent='Click the map to position '+(p.name||'this discovery');drawMap();role('map').scrollIntoView({block:'center'});});card.append(pick);
        input('x','Map X',null,'number');input('y','Map Y',null,'number');if(p.kind==='biome'){const radius=input('radius','Biome radius (5–1000)',null,'number');radius.min=5;radius.max=1000;}
      }
      for(const [key,label] of p.kind==='route'?[['from','From'],['to','To']]:p.kind==='event'?[['target','Event location']]:[]){const el=input(key,label,[['','Choose a place'],...placeOptions()]);el.dataset.reference=key;el.dataset.proposal=p.id;}
      role('cards').append(card);
    }
  }
  function scan(){const session=getAtlas().sessions[sessionId];const existing=new Set(proposals.map(p=>p.kind+':'+p.name.toLocaleLowerCase()));for(const p of proposeDiscoveries(getAtlas(),session)){if(proposals.length>=100)break;if(!existing.has(p.kind+':'+p.name.toLocaleLowerCase())){p.id=crypto.randomUUID();proposals.push(p);}}dirty=true;renderCards();drawMap();}
  for(const button of dialog.querySelectorAll('[data-add]'))button.addEventListener('click',()=>{if(proposals.length>=100){role('status').textContent='A review supports up to 100 proposals.';return;}proposals.push(discoveryDraft(button.dataset.add));dirty=true;renderCards();});
  dialog.querySelector('[data-action="scan"]').addEventListener('click',scan);
  function canClose(){return !dirty||confirm('Discard unsaved discovery decisions?');}
  dialog.querySelector('[data-action="close"]').addEventListener('click',()=>{if(canClose())dialog.close();});dialog.addEventListener('cancel',event=>{if(!canClose())event.preventDefault();});
  dialog.querySelector('[data-action="apply"]').addEventListener('click',()=>{try{
    if(JSON.stringify(getAtlas())!==baseline)throw new Error('The atlas changed. Close and reopen the review before applying.');
    const accepted=proposals.filter(p=>p.status==='accepted').length,next=applyDiscoveries(getAtlas(),sessionId,proposals);apply(next);baseline=JSON.stringify(getAtlas());proposals=structuredClone(getAtlas().sessions[sessionId].discoveryReview.proposals);dirty=false;selected=null;renderCards();drawMap();role('status').textContent=`${accepted} discoveries applied. Review saved. Close this window to use Undo on the map.`;
  }catch(error){role('status').textContent=error.message;}});
  return {open(id){sessionId=id;const session=getAtlas().sessions[id];if(!session)return;baseline=JSON.stringify(getAtlas());proposals=structuredClone(session.discoveryReview?.proposals||[]);selected=null;dirty=false;role('position').textContent='Choose Position on map on a place or biome, then click the map. Coordinates are also editable.';role('session').textContent=session.title||session.name||'Session';role('status').textContent='';
    if(!session.discoveryReview)scan();else{renderCards();drawMap();if(session.discoveryReview.source!==sessionSource(session))role('status').textContent='Session text changed. Earlier proposals keep their original source. Use Find more suggestions to review new mentions.';}
    dialog.showModal();}};
}
