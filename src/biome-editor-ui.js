import { biomeGeometry, circleAnchors, curvePoint } from './biome-curves.js';
import { displayedBiomes, prepareBiomes, visibleHandles } from './smooth-regions.js';
import { territoryColor } from './territories.js';
import { BIOME_COLORS } from './natural-geography.js';
import { biomeAtPoint, editBiome, newBiome, removeBiome } from './biome-editor.js';

// Isolated screen overlay: drag drafts never mutate the atlas until pointer-up.
export function installBiomeEditor({getWorld,getCamera,toWorld,commit,pan,onActivate,wrap,button,layer='biomes',getRealms=()=>[]}) {
  const political=layer==='territories';
  const collection=()=>!getWorld()?{}:political?getWorld().territories:getWorld().biomes;
  const regionColor=r=>political?territoryColor(r.realmId):BIOME_COLORS[r.type]||'#aaa';
  let active=false,selected=null,vertex=null,segment=null,drawing=null,drag=null,draft=null;
  const panel=document.createElement('section');panel.className='biome-editor-panel';panel.hidden=true;
  panel.innerHTML='<strong>Biome regions</strong><label>Region<select data-control="region"><option value="">Select on map</option></select></label><label>Biome<select data-control="type"></select></label><label>Priority<input data-control="priority" type="number" step="1" value="1" /></label><div class="biome-actions"><button data-action="draw">Add region</button><button data-action="finish">Close polygon</button><button data-action="cancel">Cancel drawing</button><button data-action="insert">Insert point</button><button data-action="remove-point">Delete point</button><button data-action="smooth">Smooth &amp; merge areas</button><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete region</button><button data-action="done">Done</button></div><p>Draw: click points, then click the first point or Close polygon. Select: drag a point or the region. Select an edge, then Insert point. Zoom in to reveal finer handles. Alt-drag to pan; scroll to zoom. Escape cancels.</p><p data-control="status" role="status"></p>';
  if(political) {panel.querySelector('[data-action=smooth]').hidden=true;panel.querySelector('strong').textContent='Political territories';panel.querySelector('[data-control=type]').parentElement.firstChild.textContent='Realm';}
  if(!political) {
    for(const action of ['draw','finish','cancel','smooth'])panel.querySelector('[data-action='+action+']').hidden=true;
    panel.querySelector('[data-action=smooth]').hidden=true;
    panel.querySelector('p').textContent='Drag a biome onto the land to create a circle. Drag its four points to reshape it. Double-click a boundary to add a point. Drag inside to move the area. Alt-drag pans; scroll zooms.';
    const palette=document.createElement('div');palette.className='biome-palette';
    for(const type of Object.keys(BIOME_COLORS)) {
      const tile=document.createElement('button');tile.type='button';tile.draggable=true;tile.dataset.biome=type;tile.textContent=type==='wetland'?'Swamp':type[0].toUpperCase()+type.slice(1);tile.style.borderColor=BIOME_COLORS[type];
      tile.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-mapmaker-biome',type);event.dataTransfer.effectAllowed='copy';});
      palette.append(tile);
    }
    panel.querySelector('strong').after(palette);
    const angle=document.createElement('label');angle.textContent='Tree edge angle (degrees)';const input=document.createElement('input');input.type='number';input.min='0';input.max='89';input.step='5';input.value=String(getWorld()?.forestStyle?.maxAngle??60);input.dataset.control='tree-angle';angle.append(input);palette.after(angle);
    input.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<0||value>89){status('Choose an angle from 0 to 89 degrees.');return;}commit(world=>{world.forestStyle={...world.forestStyle,maxAngle:value};},'Change forest edge angle');status('Tree edge angle updated.');});
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('biome-editor-overlay');svg.hidden=true;
  svg.setAttribute('aria-label',political?'Political territory editor':'Biome polygon editor');svg.setAttribute('tabindex','0');
  wrap.append(svg,panel);
  const control=name=>panel.querySelector(`[data-control="${name}"]`);
  if(!political)for(const type of Object.keys(BIOME_COLORS)){const option=document.createElement('option');option.value=type;option.textContent=type;control('type').append(option);}
  const selectedRegion=()=>collection()[selected];
  function status(message) {control('status').textContent=message;}
  function sync() {
    if(!political)control('tree-angle').value=String(getWorld()?.forestStyle?.maxAngle??60);
    if(political){const previous=control('type').value;control('type').replaceChildren();for(const realm of getRealms())control('type').add(new Option(realm.name,realm.id));if(previous)control('type').value=previous;}
    const id=selected,select=control('region');select.replaceChildren(new Option('Select on map',''));
    for(const r of Object.values(collection()).sort((a,b)=>(b.priority??0)-(a.priority??0)||a.id.localeCompare(b.id))) select.add(new Option(`${political?(getRealms().find(p=>p.id===r.realmId)?.name||'Realm'):r.type} · priority ${r.priority??0} · ${r.id}`,r.id));
    select.value=id||'';
    const region=selectedRegion();
    if(region){control('type').value=political?region.realmId:region.type;control('priority').value=region.priority??0;}
    for(const action of ['duplicate','delete'])panel.querySelector(`[data-action="${action}"]`).disabled=!region||!!drawing;
    panel.querySelector('[data-action="remove-point"]').disabled=!region||!vertex||!!drawing;
    panel.querySelector('[data-action="insert"]').disabled=!region||!segment||!!drawing;
    panel.querySelector('[data-action="finish"]').disabled=!drawing;
    panel.querySelector('[data-action="cancel"]').disabled=!drawing;
    draw();
  }
  function element(tag,attrs) {const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);return node;}
  function draw() {
    if(!active)return;
    const camera=getCamera(),screen=p=>[camera.x+p[0]*camera.scale,camera.y+p[1]*camera.scale];
    svg.setAttribute('width',wrap.clientWidth);svg.setAttribute('height',wrap.clientHeight);svg.replaceChildren();
    const region=draft||selectedRegion();
    if(region&&!drawing) {
      const rings=[region.points,...(region.holes||[])],geometry=biomeGeometry(region);
      element('path',{d:[geometry.points,...(geometry.holes||[])].map(r=>'M'+r.map(p=>screen(p).join(' ')).join('L')+'Z').join(''),fill:regionColor(region),'fill-opacity':'.35','fill-rule':'evenodd',stroke:'#ffe4a0','stroke-width':2});
      rings.forEach((ring,ri)=>ring.forEach((p,i)=>{
        const a=screen(p),b=screen(ring[(i+1)%ring.length]);
        element('path',{d:region.curved?'M'+Array.from({length:17},(_,j)=>screen(curvePoint(ring,i,j/16)).join(' ')).join('L'):'M'+a.join(' ')+'L'+b.join(' '),fill:'none',stroke:segment?.ring===ri&&segment.index===i?'#fff':'transparent','stroke-width':8,'data-segment':i,'data-ring':ri});
      }));
      visibleHandles(rings,camera.scale,vertex).forEach(({ring:ri,index:i,point:p})=>{const a=screen(p);element('circle',{cx:a[0],cy:a[1],r:4,fill:vertex?.ring===ri&&vertex.index===i?'#ffbd43':'#fff',stroke:'#563d23','stroke-width':1,'data-vertex':i,'data-ring':ri});});
    }
    if(drawing) {
      element('polyline',{points:drawing.map(p=>screen(p).join(',')).join(' '),fill:'none',stroke:'#ffe4a0','stroke-width':2});
      drawing.forEach((p,i)=>{const a=screen(p);element('circle',{cx:a[0],cy:a[1],r:i?4:7,fill:i?'#fff':'#ffbd43','data-close':i===0?'yes':'no'});});
    }
  }
  function save(region,label='Edit biome') {commit(world=>{world[layer][region.id]=region;},political?label.replace(/biome/gi,'territory'):label);selected=region.id;draft=null;sync();}
  function dropBiome(type,x,y) {
    if(!Object.hasOwn(BIOME_COLORS,type))return;
    const p=toWorld(x,y),r=newBiome(crypto.randomUUID(),type,circleAnchors(p.x,p.y,65/getCamera().scale),1+Math.max(0,...Object.values(collection()).map(r=>r.priority||0)));
    r.curved=true;r.boundaryVersion=2;drawing=null;vertex=null;segment=null;save(r,'Add biome circle');status('Drag a point to reshape; double-click the boundary to add a point.');
  }
  svg.addEventListener('dragover',event=>{if(!political){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
  svg.addEventListener('drop',event=>{if(political)return;event.preventDefault();event.stopPropagation();try{dropBiome(event.dataTransfer.getData('application/x-mapmaker-biome'),event.clientX,event.clientY);}catch(e){status(e.message);}});
  function finish() {try{const owner=control('type').value;if(political&&!getRealms().some(p=>p.id===owner))throw new Error('Add a realm to this world before drawing its territory.');const r=newBiome(crypto.randomUUID(),political?'territory':owner,drawing,Number(control('priority').value));if(political)r.realmId=owner;drawing=null;save(r,'Draw biome');status('Region saved and protected from regeneration.');}catch(e){status(e.message);}}
  function cancel() {drag=null;draft=null;drawing=null;vertex=null;segment=null;sync();status('Uncommitted edit cancelled.');}
  function toggle(value) {
    active=value&&getWorld()?.mode==='independent';panel.hidden=!active;svg.hidden=!active;svg.toggleAttribute('hidden',!active);svg.style.display=active?'block':'none';button.setAttribute('aria-pressed',String(active));
    if(active)onActivate?.();
    if(!active){drawing=null;drag=null;draft=null;}else {status(political?'Select a region or choose Add region.':'Drag a biome from the palette onto the map.');sync();}
  }
  button.addEventListener('click',()=>toggle(!active));
  panel.addEventListener('pointerdown',e=>e.stopPropagation());panel.addEventListener('wheel',e=>e.stopPropagation());panel.addEventListener('dblclick',e=>e.stopPropagation());
  panel.addEventListener('click',event=>{
    const action=event.target.dataset.action;if(!action)return;
    try {
      if(action==='draw'){drawing=[];vertex=null;segment=null;sync();status('Click at least three points.');}
      if(action==='finish')finish();
      if(action==='cancel')cancel();
      if(action==='done')toggle(false);
      if(action==='smooth'&&!political){commit(world=>{world.biomes=prepareBiomes(world.biomes,world.fields?.step||10,{smoothAll:true});for(const r of Object.values(world.biomes)){r.editState='manually-edited';r.protected=true;}},'Smooth and merge biomes');vertex=null;segment=null;sync();status('Areas simplified and merged. Undo restores the previous boundaries.');}
      if(action==='insert'&&segment){const r=editBiome(selectedRegion(),{kind:'insert',...segment,...(selectedRegion().curved?{point:curvePoint([selectedRegion().points,...(selectedRegion().holes||[])][segment.ring],segment.index,.5)}:{})});vertex={ring:segment.ring,index:segment.index+1};segment=null;save(r,'Insert biome point');}
      if(action==='remove-point'&&vertex){const r=editBiome(selectedRegion(),{kind:'delete-vertex',...vertex});vertex=null;save(r,'Delete biome point');}
      if(action==='duplicate'){const r=editBiome(selectedRegion(),{kind:'move',dx:20/getCamera().scale,dy:20/getCamera().scale});r.id=crypto.randomUUID();r.provenance={kind:'manual',copiedFrom:selected};save(r,'Duplicate biome');}
      if(action==='delete'){const id=selected;selected=null;vertex=null;segment=null;commit(world=>{if(political)delete world.territories[id];else {removeBiome(world,id);}},political?'Delete territory':'Delete biome');sync();}
    } catch(e){status(e.message);}
  });
  control('region').addEventListener('change',()=>{selected=control('region').value||null;vertex=null;segment=null;drawing=null;sync();});
  for(const name of ['type','priority'])control(name).addEventListener('change',()=>{
    if(!selectedRegion()||drawing)return;
    try{const r=editBiome(selectedRegion(),{kind:'properties',type:political?'territory':control('type').value,priority:Number(control('priority').value)});if(political)r.realmId=control('type').value;save(r);}catch(e){status(e.message);sync();}
  });
  svg.addEventListener('pointerdown',event=>{
    if(!active||event.button!==0)return;event.stopPropagation();event.preventDefault();svg.focus();
    const p=toWorld(event.clientX,event.clientY),point=[p.x,p.y];
    if(event.altKey){drag={kind:'pan',x:event.clientX,y:event.clientY};svg.setPointerCapture(event.pointerId);return;}
    if(drawing){if(event.target.dataset.close==='yes'&&drawing.length>=3)finish();else {drawing.push(point);draw();}return;}
    const ri=Number(event.target.dataset.ring||0);
    if(event.target.dataset.vertex!=null){vertex={ring:ri,index:Number(event.target.dataset.vertex)};segment=null;drag={kind:'vertex',...vertex,original:structuredClone(selectedRegion()),point};}
    else if(event.target.dataset.segment!=null){segment={ring:ri,index:Number(event.target.dataset.segment)};vertex=null;return;}
    else {
      const hit=biomeAtPoint(collection(),...point);selected=hit?.id||null;vertex=null;segment=null;
      if(hit)drag={kind:'move',point,original:structuredClone(hit)};
    }
    if(drag)svg.setPointerCapture(event.pointerId);sync();
  });
  svg.addEventListener('pointermove',event=>{
    if(!drag)return;event.stopPropagation();
    if(drag.kind==='pan'){pan(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;return;}
    const p=toWorld(event.clientX,event.clientY);
    // Validate only at commit, so an invalid intermediate shape can be corrected.
    draft=structuredClone(drag.original);
    if(drag.kind==='vertex')[draft.points,...(draft.holes||[])][drag.ring][drag.index]=[p.x,p.y];
    else for(const ring of [draft.points,...(draft.holes||[])])for(const q of ring){q[0]+=p.x-drag.point[0];q[1]+=p.y-drag.point[1];}
    draw();
  });
  svg.addEventListener('pointerup',event=>{
    event.stopPropagation();if(!drag)return;
    const pending=drag;drag=null;
    if(draft)try{
      if(JSON.stringify(draft)!==JSON.stringify(pending.original))save(editBiome(draft,{kind:'move',dx:0,dy:0}),pending.kind==='vertex'?'Move biome point':'Move biome');
    }catch(e){status(e.message);}
    draft=null;sync();
  });
  svg.addEventListener('pointercancel',event=>{event.stopPropagation();cancel();});
  svg.addEventListener('dblclick',event=>{
    event.stopPropagation();event.preventDefault();
    const index=event.target.dataset.segment;
    if(index==null||!selectedRegion()||drawing)return;
    try {
      const ring=Number(event.target.dataset.ring||0),region=selectedRegion(),points=[region.points,...(region.holes||[])][ring],p=toWorld(event.clientX,event.clientY);
      let point=[p.x,p.y];
      if(region.curved) {
        let best=Infinity;
        for(let j=1;j<100;j++){const q=curvePoint(points,Number(index),j/100),d=Math.hypot(q[0]-p.x,q[1]-p.y);if(d<best){point=q;best=d;}}
      }
      const next=editBiome(region,{kind:'insert',ring,index:Number(index),point});
      vertex={ring,index:Number(index)+1};segment=null;save(next,'Insert biome point');status('Point added. Drag it to reshape the boundary.');
    }catch(e){status(e.message);}
  });
  return {
    get active(){return active;},
    refresh(){button.hidden=getWorld()?.mode!=='independent';if(button.hidden)toggle(false);if(selected&&!selectedRegion())selected=null;if(active)sync();},
    draw,
    key(event){if(!active||event.target.closest('input,select,textarea'))return false;if(event.key==='Escape'){if(drawing||drag)cancel();else toggle(false);return true;}if(event.key==='Enter'&&drawing&&!event.target.closest('button')){finish();return true;}if(event.key==='Delete'||event.key==='Backspace'){panel.querySelector(`[data-action="${vertex?'remove-point':'delete'}"]`).click();return true;}return false;},
    close(){toggle(false);},
    cancelDraft(){if(drawing||drag)cancel();},
  };
}
