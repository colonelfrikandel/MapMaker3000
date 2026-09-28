// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
const STORAGE_KEY = 'mapmaker3000.atlas.v1';
const TYPES = {
  world: { label: 'World', icon: '✧', color: '#806b4e', bg: '#f3ead6' },
  continent: { label: 'Continent', icon: '✥', color: '#806b4e', bg: '#f3ead6' },
  province: { label: 'Province', icon: '◆', color: '#527e72', bg: '#e1eee6' },
  region: { label: 'Region', icon: '◈', color: '#527e72', bg: '#e1eee6' },
  town: { label: 'Town', icon: '♜', color: '#986441', bg: '#f3e4d3' },
  village: { label: 'Village', icon: '⌂', color: '#61826e', bg: '#e6efe3' },
  landmark: { label: 'Landmark', icon: '✦', color: '#927844', bg: '#f5edd5' },
  house: { label: 'House', icon: '⌂', color: '#a66d60', bg: '#f6e6df' },
  room: { label: 'Room', icon: '▣', color: '#7d7796', bg: '#ebe8f3' },
};
const PALETTES = {
  world: ['continent', 'region', 'landmark'],
  continent: ['province', 'landmark'],
  province: ['town', 'village', 'landmark'],
  region: ['town', 'village', 'landmark'],
  town: ['house', 'landmark'],
  village: ['house', 'landmark'],
  landmark: [],
  house: ['room'],
  room: [],
};
const DEFAULT_NAMES = { continent: 'New continent', province: 'New province', region: 'New region', town: 'New town', village: 'New village', landmark: 'New landmark', house: 'New house', room: 'New room' };
const ENTERABLE = new Set(['continent', 'province', 'region', 'town', 'village', 'house']);
const $ = (selector) => document.querySelector(selector);
const els = {
  wrap: $('#canvas-wrap'), canvas: $('#map-canvas'), layer: $('#places-layer'), tree: $('#board-tree'), palette: $('#palette'),
  breadcrumbs: $('#breadcrumbs'), title: $('#map-title'), subtitle: $('#map-subtitle'), kind: $('#map-kind'),
  inspector: $('#inspector'), inspectorHeading: $('#inspector-heading'), inspectorEmpty: $('#inspector-empty'), inspectorForm: $('#inspector-form'),
  name: $('#place-name'), type: $('#place-type'), description: $('#place-description'), notes: $('#place-notes'), enter: $('#enter-place'),
  zoomLabel: $('#zoom-label'), hint: $('#empty-hint'), saveStatus: $('#save-status'), toast: $('#toast'), importInput: $('#import-input'),
};

function id() { return crypto.randomUUID(); }
function makeBoard(name, kind, parentPlaceId = null) { return { id: id(), name, kind, parentPlaceId, placeIds: [] }; }
function makePlace(boardId, type, name, x, y) {
  return { id: id(), boardId, type, name, x, y, description: '', notes: '', childBoardId: null,
    provenance: { kind: 'manual', sessionRefs: [] } };
}
function starterAtlas() {
  const root = makeBoard('The Shattered Realm', 'world');
  const atlas = { schemaVersion: 1, rootBoardId: root.id, boards: { [root.id]: root }, places: {}, sessions: {} };
  const add = (parent, type, name, x, y) => {
    const item = makePlace(parent.id, type, name, x, y);
    atlas.places[item.id] = item; parent.placeIds.push(item.id);
    if (ENTERABLE.has(type)) { const child = makeBoard(name, type, item.id); atlas.boards[child.id] = child; item.childBoardId = child.id; }
    return item.childBoardId ? atlas.boards[item.childBoardId] : null;
  };
  const continents = [
    ['Aldervale', ['The Ashen Coast', 'The High March'], ['Greyharbor', 'Briar Glen']],
    ['Veyr', ['Sunfall Reach', 'The Glass Plains'], ['Emberfall', 'Duskford']],
    ['Namaris', ['The Verdant Crown', 'Stormward'], ['Thornhaven', 'Moss Hollow']],
  ];
  continents.forEach(([name, provinces, settlements], index) => {
    const continent = add(root, 'continent', name, 85 + index * 320, index === 1 ? 285 : 145);
    provinces.forEach((provinceName, p) => {
      const province = add(continent, 'province', provinceName, 185 + p * 420, p === 0 ? 160 : 390);
      const town = add(province, 'town', settlements[p], 245, 210);
      const village = add(province, 'village', p === 0 ? 'Willowmere' : 'Oakrest', 620, 405);
      for (const [settlement, prefix] of [[town, 'The Copper Lantern'], [village, 'The Old Cottage']]) {
        const house = add(settlement, 'house', prefix, 340, 265);
        add(house, 'room', 'Common room', 210, 170);
        add(house, 'room', 'Cellar', 570, 360);
      }
    });
  });
  return atlas;
}
function loadAtlas() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return validateAtlas(JSON.parse(saved));
  } catch (error) { console.warn('Could not load saved atlas', error); }
  return starterAtlas();
}
function validateAtlas(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.boards !== 'object' || typeof value.places !== 'object' ||
      !value.boards[value.rootBoardId] || !Array.isArray(value.boards[value.rootBoardId].placeIds)) throw new Error('Unsupported atlas file');
  for (const board of Object.values(value.boards)) {
    if (!board || typeof board.name !== 'string' || !Array.isArray(board.placeIds)) throw new Error('Invalid map data');
    for (const placeId of board.placeIds) {
      const place = value.places[placeId];
      if (!place || place.boardId !== board.id || !TYPES[place.type] || !Number.isFinite(place.x) || !Number.isFinite(place.y)) throw new Error('Invalid place data');
    }
  }
  value.sessions ||= {};
  return value;
}

let atlas = loadAtlas();
let currentBoardId = atlas.rootBoardId;
let selectedPlaceId = null;
let placingType = null;
let camera = { x: 0, y: 0, scale: 1 };
let gesture = null;
let saveTimer = null;
let toastTimer = null;
let wheelIdleTimer = null;
let wheelChangedLevel = false;
let wheelDistance = 0;
let wheelDirection = 0;
let lastWheelAt = 0;
let lastDragEnd = 0;
const cameraByBoard = new Map();

function board() { return atlas.boards[currentBoardId]; }
function place(id) { return atlas.places[id]; }
function scheduleSave() {
  els.saveStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(atlas)); els.saveStatus.textContent = 'Saved in this browser'; }
    catch (error) { els.saveStatus.textContent = 'Save failed — export a backup'; toast('Browser storage is full. Export a backup.'); }
  }, 250);
}
function toast(message) {
  els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3100);
}
function defaultCamera() {
  const scale = Math.max(0.45, Math.min(1, (els.wrap.clientWidth - 30) / 1010));
  return {
    x: Math.max(12, (els.wrap.clientWidth - 1010 * scale) / 2),
    y: Math.max(20, (els.wrap.clientHeight - 630 * scale) / 2),
    scale,
  };
}
function fitCamera(boardId) {
  const target = atlas.boards[boardId];
  if (!target?.placeIds.length) return defaultCamera();
  const items = target.placeIds.map(place).filter(Boolean);
  const left = Math.min(...items.map(item => item.x));
  const top = Math.min(...items.map(item => item.y));
  const right = Math.max(...items.map(item => item.x + (item.type === 'continent' ? 250 : item.type === 'province' || item.type === 'region' ? 205 : item.type === 'room' ? 180 : 152)));
  const bottom = Math.max(...items.map(item => item.y + (item.type === 'continent' ? 178 : item.type === 'room' ? 135 : 125)));
  const scale = Math.max(0.45, Math.min(1, (els.wrap.clientWidth - 70) / (right - left), (els.wrap.clientHeight - 70) / (bottom - top)));
  return {
    x: (els.wrap.clientWidth - (right + left) * scale) / 2,
    y: (els.wrap.clientHeight - (bottom + top) * scale) / 2,
    scale,
  };
}
function renderCamera() {
  els.canvas.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  els.zoomLabel.textContent = `${Math.round(camera.scale * 100)}%`;
}
function screenToMap(clientX, clientY) {
  const rect = els.wrap.getBoundingClientRect();
  return { x: (clientX - rect.left - camera.x) / camera.scale, y: (clientY - rect.top - camera.y) / camera.scale };
}
function zoomAt(factor, clientX, clientY) {
  const old = screenToMap(clientX, clientY);
  camera.scale = Math.max(0.45, Math.min(2.2, camera.scale * factor));
  const rect = els.wrap.getBoundingClientRect();
  camera.x = clientX - rect.left - old.x * camera.scale;
  camera.y = clientY - rect.top - old.y * camera.scale;
  renderCamera();
}
function findZoomTarget(point) {
  let nearest = null; let best = Infinity;
  for (const pid of board().placeIds) {
    const item = place(pid); if (!item || !ENTERABLE.has(item.type)) continue;
    const width = item.type === 'continent' ? 250 : item.type === 'province' || item.type === 'region' ? 205 : 152;
    const centerX = item.x + width / 2, centerY = item.y + 60;
    const distance = Math.hypot(point.x - centerX, point.y - centerY);
    const reach = item.type === 'continent' ? 235 : item.type === 'province' || item.type === 'region' ? 180 : 105;
    if (distance < reach && distance < best) { best = distance; nearest = item; }
  }
  return nearest;
}
function changeBoard(boardId, nextCamera = null) {
  if (!atlas.boards[boardId]) return;
  cameraByBoard.set(currentBoardId, { ...camera });
  currentBoardId = boardId; selectedPlaceId = null; placingType = null;
  camera = nextCamera || cameraByBoard.get(boardId) || fitCamera(boardId);
  render();
}
function zoomToParent() {
  const parentPlace = place(board().parentPlaceId);
  if (!parentPlace) return;
  changeBoard(parentPlace.boardId, fitCamera(parentPlace.boardId));
}
function boardAncestors() {
  const result = [];
  let next = board();
  while (next) { result.unshift(next); next = next.parentPlaceId ? atlas.boards[place(next.parentPlaceId)?.boardId] : null; }
  return result;
}
function renderNavigation() {
  els.breadcrumbs.replaceChildren();
  for (const [index, item] of boardAncestors().entries()) {
    if (index) { const sep = document.createElement('span'); sep.className = 'crumb-separator'; sep.textContent = '/'; els.breadcrumbs.append(sep); }
    const button = document.createElement('button'); button.className = 'crumb'; button.textContent = item.name;
    button.addEventListener('click', () => changeBoard(item.id)); els.breadcrumbs.append(button);
  }
  els.tree.replaceChildren();
  const activePath = new Set(boardAncestors().map(item => item.id));
  function addTreeItem(item, depth, seen) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const button = document.createElement('button'); button.className = `tree-item${item.id === currentBoardId ? ' active' : ''}`;
    button.style.paddingLeft = `${9 + depth * 14}px`;
    const glyph = document.createElement('span'); glyph.className = 'tree-glyph'; glyph.textContent = TYPES[item.kind]?.icon || '✧';
    const label = document.createElement('span'); label.textContent = item.name;
    button.append(glyph, label); button.addEventListener('click', () => changeBoard(item.id)); els.tree.append(button);
    if (activePath.has(item.id)) for (const pid of item.placeIds) {
      const childId = place(pid)?.childBoardId;
      if (childId && atlas.boards[childId]) addTreeItem(atlas.boards[childId], depth + 1, seen);
    }
  }
  addTreeItem(atlas.boards[atlas.rootBoardId], 0, new Set());
}
function renderPalette() {
  els.palette.replaceChildren();
  for (const type of PALETTES[board().kind] || PALETTES.world) {
    const button = document.createElement('button'); button.className = `palette-item${placingType === type ? ' active' : ''}`;
    button.draggable = true; button.dataset.type = type;
    const icon = document.createElement('span'); icon.className = 'palette-icon'; icon.textContent = TYPES[type].icon; icon.style.color = TYPES[type].color;
    const label = document.createElement('span'); label.textContent = TYPES[type].label;
    button.append(icon, label);
    button.addEventListener('click', () => { placingType = placingType === type ? null : type; renderPalette(); els.wrap.classList.toggle('placing', !!placingType); });
    button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/mapmaker-place', type); event.dataTransfer.effectAllowed = 'copy'; });
    els.palette.append(button);
  }
  els.wrap.classList.toggle('placing', !!placingType);
}
function renderPlaces() {
  els.layer.replaceChildren();
  for (const pid of board().placeIds) {
    const item = place(pid); if (!item) continue;
    const card = document.createElement('div'); card.className = `place-card${pid === selectedPlaceId ? ' selected' : ''}`;
    card.dataset.type = item.type;
    card.dataset.placeId = pid; card.style.left = `${item.x}px`; card.style.top = `${item.y}px`;
    card.style.setProperty('--icon-bg', TYPES[item.type].bg); card.style.setProperty('--icon-color', TYPES[item.type].color);
    const icon = document.createElement('span'); icon.className = 'card-icon'; icon.textContent = TYPES[item.type].icon;
    const title = document.createElement('span'); title.className = 'card-title'; title.textContent = item.name;
    const meta = document.createElement('span'); meta.className = 'card-meta'; meta.textContent = TYPES[item.type].label;
    const enter = document.createElement('span'); enter.className = 'card-enter'; enter.textContent = ENTERABLE.has(item.type) ? '↘' : '';
    card.append(icon, title, meta, enter); els.layer.append(card);
  }
  els.hint.hidden = board().placeIds.length > 0;
}
function renderInspector() {
  const item = selectedPlaceId ? place(selectedPlaceId) : null;
  els.inspector.classList.toggle('open', !!item);
  els.inspectorHeading.textContent = item ? item.name : 'Select a place';
  els.inspectorEmpty.hidden = !!item; els.inspectorForm.hidden = !item;
  if (!item) return;
  els.name.value = item.name; els.description.value = item.description || ''; els.notes.value = item.notes || '';
  els.type.replaceChildren();
  for (const type of PALETTES[board().kind] || PALETTES.world) {
    const option = document.createElement('option'); option.value = type; option.textContent = TYPES[type].label; els.type.append(option);
  }
  if (![...els.type.options].some(option => option.value === item.type)) {
    const option = document.createElement('option'); option.value = item.type; option.textContent = TYPES[item.type].label; els.type.append(option);
  }
  els.type.value = item.type;
  els.enter.textContent = 'Zoom into this place ↘';
  els.enter.hidden = !ENTERABLE.has(item.type);
}
function renderHeader() {
  els.title.textContent = board().name;
  els.kind.textContent = `${TYPES[board().kind]?.label || 'Map'} map`.toUpperCase();
  els.wrap.dataset.mapKind = board().kind;
  els.subtitle.textContent = board().kind === 'world' ? 'Scroll over a continent to journey inside.' :
    board().kind === 'house' ? 'The final level: rooms and the stories within them.' : 'Scroll over a place to reveal the next level.';
}
function render() { renderNavigation(); renderPalette(); renderPlaces(); renderInspector(); renderHeader(); renderCamera(); }
function selectPlace(pid) {
  selectedPlaceId = pid;
  for (const card of els.layer.querySelectorAll('.place-card')) card.classList.toggle('selected', card.dataset.placeId === pid);
  renderInspector();
}
function addPlace(type, x, y) {
  if (!TYPES[type]) return;
  const item = makePlace(currentBoardId, type, DEFAULT_NAMES[type] || 'New place', Math.round(x), Math.round(y));
  atlas.places[item.id] = item; board().placeIds.push(item.id); placingType = null;
  if (ENTERABLE.has(type)) { const child = makeBoard(item.name, type, item.id); atlas.boards[child.id] = child; item.childBoardId = child.id; }
  render(); selectPlace(item.id); scheduleSave(); toast(`${TYPES[type].label} added`);
  if (window.innerWidth > 1050) els.name.focus();
}
function enterPlace(target = null) {
  const item = target?.id ? target : place(selectedPlaceId); if (!item || !ENTERABLE.has(item.type)) return;
  if (!item.childBoardId) {
    const child = makeBoard(item.name, item.type, item.id);
    atlas.boards[child.id] = child; item.childBoardId = child.id; scheduleSave();
  }
  changeBoard(item.childBoardId, fitCamera(item.childBoardId));
}
function deletePlace() {
  const item = place(selectedPlaceId); if (!item) return;
  const message = item.childBoardId ? `Delete ${item.name} and its detail map? This cannot be undone.` : `Delete ${item.name}?`;
  if (!confirm(message)) return;
  function removeDescendants(pid) {
    const target = place(pid); if (!target) return;
    if (target.childBoardId) {
      const child = atlas.boards[target.childBoardId];
      if (child) { for (const nestedId of [...child.placeIds]) removeDescendants(nestedId); delete atlas.boards[child.id]; }
    }
    delete atlas.places[pid];
  }
  board().placeIds = board().placeIds.filter(pid => pid !== item.id);
  removeDescendants(item.id); selectedPlaceId = null; render(); scheduleSave(); toast('Place deleted');
}

function cardAtPoint(clientX, clientY) {
  const cards = [...els.layer.querySelectorAll('.place-card')];
  return cards.reverse().find(card => {
    const rect = card.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}
els.wrap.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('.zoom-controls')) return;
  const card = event.target.closest('.place-card') || cardAtPoint(event.clientX, event.clientY);
  if (card) {
    const item = place(card.dataset.placeId); if (!item) return;
    selectPlace(item.id);
    gesture = { kind: 'place', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, item, card, moved: false };
  } else if (!event.target.closest('.canvas-tip')) {
    if (placingType) { const point = screenToMap(event.clientX, event.clientY); addPlace(placingType, point.x - 76, point.y - 55); return; }
    selectPlace(null); gesture = { kind: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: camera.x, y: camera.y };
    els.wrap.classList.add('panning');
  }
  if (gesture) els.wrap.setPointerCapture(event.pointerId);
});
els.wrap.addEventListener('pointermove', (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
  if (gesture.kind === 'pan') {
    if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
    camera.x = gesture.x + dx; camera.y = gesture.y + dy; renderCamera();
  }
  else if (Math.abs(dx) + Math.abs(dy) > 3 || gesture.moved) {
    gesture.moved = true; gesture.item.x = Math.round(gesture.x + dx / camera.scale); gesture.item.y = Math.round(gesture.y + dy / camera.scale);
    gesture.card.style.left = `${gesture.item.x}px`; gesture.card.style.top = `${gesture.item.y}px`;
    gesture.card.classList.add('dragging'); els.wrap.classList.add('dragging-place');
  }
});
function endGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (gesture.kind === 'place' && gesture.moved) scheduleSave();
  gesture.card?.classList.remove('dragging');
  if (gesture.moved) lastDragEnd = performance.now();
  gesture = null; els.wrap.classList.remove('panning', 'dragging-place');
}
els.wrap.addEventListener('pointerup', endGesture);
els.wrap.addEventListener('pointercancel', endGesture);
els.wrap.addEventListener('dblclick', event => {
  const card = event.target.closest('.place-card'); if (!card) return;
  selectPlace(card.dataset.placeId); enterPlace();
});
els.wrap.addEventListener('wheel', event => {
  event.preventDefault();
  if (gesture || performance.now() - lastDragEnd < 220) return;
  const rawDelta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? els.wrap.clientHeight : 1);
  if (!rawDelta) return;
  const direction = Math.sign(rawDelta);
  const now = performance.now();
  if (now - lastWheelAt > 230 || direction !== wheelDirection) {
    wheelDistance = 0;
    if (direction !== wheelDirection && Math.abs(rawDelta) > 15) wheelChangedLevel = false;
  }
  lastWheelAt = now;
  wheelDirection = direction;
  clearTimeout(wheelIdleTimer);
  wheelIdleTimer = setTimeout(() => { wheelChangedLevel = false; wheelDistance = 0; }, 230);
  if (wheelChangedLevel) return;
  wheelDistance += Math.min(250, Math.abs(rawDelta));
  if (wheelDistance >= 75) {
    const card = event.target.closest('.place-card');
    const target = card ? place(card.dataset.placeId) : findZoomTarget(screenToMap(event.clientX, event.clientY));
    if (direction < 0 && target && ENTERABLE.has(target.type)) {
      enterPlace(target); wheelChangedLevel = true; wheelDistance = 0; return;
    }
    if (direction > 0 && board().parentPlaceId) {
      zoomToParent(); wheelChangedLevel = true; wheelDistance = 0; return;
    }
    wheelDistance = 0;
  }
  const delta = Math.max(-120, Math.min(120, rawDelta));
  zoomAt(Math.exp(-delta * 0.0012), event.clientX, event.clientY);
}, { passive: false });
els.wrap.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('text/mapmaker-place')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
els.wrap.addEventListener('drop', event => {
  const type = event.dataTransfer.getData('text/mapmaker-place'); if (!TYPES[type]) return;
  event.preventDefault(); const point = screenToMap(event.clientX, event.clientY); addPlace(type, point.x - 76, point.y - 55);
});

els.name.addEventListener('input', () => {
  const item = place(selectedPlaceId); if (!item) return; item.name = els.name.value || 'Unnamed place';
  if (item.childBoardId) atlas.boards[item.childBoardId].name = item.name;
  els.inspectorHeading.textContent = item.name; renderPlaces(); renderNavigation(); scheduleSave();
});
els.type.addEventListener('change', () => {
  const item = place(selectedPlaceId); if (!item) return; item.type = els.type.value;
  if (item.childBoardId) atlas.boards[item.childBoardId].kind = item.type;
  renderPlaces(); renderInspector(); scheduleSave();
});
for (const [input, key] of [[els.description, 'description'], [els.notes, 'notes']]) {
  input.addEventListener('input', () => { const item = place(selectedPlaceId); if (item) { item[key] = input.value; scheduleSave(); } });
}
els.enter.addEventListener('click', enterPlace);
$('#delete-place').addEventListener('click', deletePlace);
$('#close-inspector').addEventListener('click', () => selectPlace(null));
$('#add-place').addEventListener('click', () => { els.palette.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); toast('Choose a place from the left, then click the map'); });
$('#new-atlas-button').addEventListener('click', () => {
  if (!confirm('Start a new example atlas? This replaces the atlas saved in this browser. Export a backup first if you want to keep it.')) return;
  atlas = starterAtlas(); currentBoardId = atlas.rootBoardId; selectedPlaceId = null; placingType = null;
  cameraByBoard.clear(); camera = defaultCamera(); render(); scheduleSave(); toast('New atlas created');
});
$('#rename-board').addEventListener('click', () => {
  const name = prompt('Map name', board().name)?.trim(); if (!name) return;
  board().name = name; if (board().parentPlaceId) { const parent = place(board().parentPlaceId); if (parent) parent.name = name; }
  render(); scheduleSave();
});
$('#zoom-in').addEventListener('click', () => {
  if (selectedPlaceId && ENTERABLE.has(place(selectedPlaceId)?.type)) { enterPlace(); return; }
  const r = els.wrap.getBoundingClientRect(); zoomAt(1.25, r.left + r.width / 2, r.top + r.height / 2);
});
$('#zoom-out').addEventListener('click', () => {
  if (board().parentPlaceId) { zoomToParent(); return; }
  const r = els.wrap.getBoundingClientRect(); zoomAt(0.8, r.left + r.width / 2, r.top + r.height / 2);
});
$('#zoom-reset').addEventListener('click', () => { camera = defaultCamera(); renderCamera(); });
$('#export-button').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(atlas, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `mapmaker-atlas-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Atlas exported');
});
$('#import-button').addEventListener('click', () => els.importInput.click());
els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files?.[0]; if (!file) return;
  try {
    const next = validateAtlas(JSON.parse(await file.text()));
    if (!confirm('Replace the current atlas with this file? Export a backup first if you want to keep it.')) return;
    atlas = next; currentBoardId = atlas.rootBoardId; selectedPlaceId = null; placingType = null;
    cameraByBoard.clear(); camera = defaultCamera(); render(); scheduleSave(); toast('Atlas imported');
  } catch (error) { toast('This file is not a valid MapMaker atlas'); }
  finally { els.importInput.value = ''; }
});
const helpDialog = $('#help-dialog');
$('#help-button').addEventListener('click', () => helpDialog.showModal());
$('#help-close').addEventListener('click', () => helpDialog.close());
$('#help-done').addEventListener('click', () => helpDialog.close());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { placingType = null; renderPalette(); selectPlace(null); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedPlaceId && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) deletePlace();
});
window.addEventListener('resize', () => renderCamera());

camera = defaultCamera(); render(); scheduleSave();
