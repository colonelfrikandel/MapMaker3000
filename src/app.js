// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
import { buildLayout, cardSize, levelAtScale, blend, nearbyPlaces, nearbyRoutes, ZOOM_STEP, MAX_DEPTH } from './geometry.js';
import { planDetails } from './generator.js';
import { artworkForPlace, artworkForBoard } from './cartography.js?v=world-base-1';
import { validateTownBase, nearestTownFootprint } from './town-base.js';
import { generateTownBase } from './town-generator.js';
import { addVillageExample, addCampaignEvent, planSettlement, applySettlement, villageType } from './campaign.js';
const STORAGE_KEY = 'mapmaker3000.atlas.v1';
const TYPES = {
  world: { label: 'World', icon: '✧', color: '#806b4e', bg: '#f3ead6' },
  continent: { label: 'Realm', icon: '✥', color: '#806b4e', bg: '#f3ead6' },
  province: { label: 'Province', icon: '◆', color: '#527e72', bg: '#e1eee6' },
  region: { label: 'Region', icon: '◈', color: '#527e72', bg: '#e1eee6' },
  town: { label: 'Town', icon: '♜', color: '#986441', bg: '#f3e4d3' },
  village: { label: 'Village', icon: '⌂', color: '#61826e', bg: '#e6efe3' },
  landmark: { label: 'Landmark', icon: '✦', color: '#927844', bg: '#f5edd5' },
  house: { label: 'House', icon: '⌂', color: '#a66d60', bg: '#f6e6df' },
  room: { label: 'Room', icon: '▣', color: '#7d7796', bg: '#ebe8f3' },
};
const PALETTES = {
  world: ['continent', 'landmark'],
  continent: ['province', 'landmark'],
  province: ['town', 'village', 'landmark'],
  region: ['town', 'village', 'landmark'],
  town: ['house', 'landmark'],
  village: ['house', 'landmark'],
  landmark: [],
  house: ['room', 'landmark'],
  room: [],
};
const DEFAULT_NAMES = { continent: 'New continent', province: 'New province', region: 'New region', town: 'New town', village: 'New village', landmark: 'New landmark', house: 'New house', room: 'New room' };
const ENTERABLE = new Set(['continent', 'province', 'region', 'town', 'village', 'house']);
const ROUTE_TYPES = { road: 'Road', trail: 'Trail', river: 'River', sea: 'Sea route', passage: 'Passage' };
const REALM_BIOMES = ['forest', 'plains', 'highland', 'snow', 'desert', 'marsh', 'coast', 'mixed'];
function randomRealmBiome(name) {
  let value = 2166136261;
  for (const char of name) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return REALM_BIOMES[(value >>> 0) % REALM_BIOMES.length];
}
const $ = (selector) => document.querySelector(selector);
const els = {
  wrap: $('#canvas-wrap'), canvas: $('#map-canvas'), layer: $('#places-layer'), tree: $('#board-tree'), palette: $('#palette'),
  breadcrumbs: $('#breadcrumbs'), title: $('#map-title'), subtitle: $('#map-subtitle'), kind: $('#map-kind'),
  inspector: $('#inspector'), inspectorHeading: $('#inspector-heading'), inspectorEmpty: $('#inspector-empty'), inspectorForm: $('#inspector-form'),
  name: $('#place-name'), type: $('#place-type'), description: $('#place-description'), notes: $('#place-notes'), enter: $('#enter-place'),
  realmOptions: $('#realm-options'), realmBiome: $('#realm-biome'), realmIsland: $('#realm-island'),
  zoomLabel: $('#zoom-label'), hint: $('#empty-hint'), saveStatus: $('#save-status'), toast: $('#toast'), importInput: $('#import-input'),
  routesLayer: $('#routes-layer'), terrainLayer: $('#terrain-layer'), connect: $('#connect-places'), connectInstructions: $('#connect-instructions'),
  inspectorKind: $('#inspector-kind'), routeForm: $('#route-form'), routeName: $('#route-name'), routeType: $('#route-type'),
  routeDescription: $('#route-description'), routeNotes: $('#route-notes'),
  generateButton: $('#generate-details'), generatorDialog: $('#generator-dialog'), generatorTitle: $('#generator-title'),
  generatorIntro: $('#generator-intro'), generatorSeed: $('#generator-seed'), generatorSize: $('#generator-size'),
  generatorPreview: $('#generator-preview'), generatorMapPreview: $('#generator-map-preview'), generatorApply: $('#generator-apply'),
};

function id() { return crypto.randomUUID(); }
function makeBoard(name, kind, parentPlaceId = null) {
  const result = { id: id(), name, kind, parentPlaceId, placeIds: [] };
  if (kind === 'town' || kind === 'village') result.baseMap = generateTownBase(kind, name, 'standard');
  return result;
}
function makePlace(boardId, type, name, x, y) {
  const result = { id: id(), boardId, type, name, x, y, description: '', notes: '', childBoardId: null,
    provenance: { kind: 'manual', sessionRefs: [] } };
  if (type === 'continent') { result.biome = randomRealmBiome(name); result.island = false; }
  return result;
}
function makeRoute(boardId, fromPlaceId, toPlaceId, type = 'road', name = 'New road') {
  return { id: id(), boardId, fromPlaceId, toPlaceId, type, name, description: '', notes: '',
    provenance: { kind: 'manual', sessionRefs: [] } };
}
function starterAtlas() {
  const root = makeBoard('The Four Realms', 'world');
  root.worldSeed = 'four-realms';
  const atlas = { schemaVersion: 1, rootBoardId: root.id, boards: { [root.id]: root }, places: {}, routes: {}, sessions: {} };
  const add = (parent, type, name, x, y) => {
    const item = makePlace(parent.id, type, name, x, y);
    if (type === 'house' && parent.baseMap) {
      const footprint = nearestTownFootprint(parent.baseMap, { x:x+cardSize(type)[0]/2, y:y+cardSize(type)[1]/2 }, 1000);
      if (footprint) { item.baseFootprintIndex = footprint.index; item.x = Math.round(footprint.x-cardSize(type)[0]/2); item.y = Math.round(footprint.y-cardSize(type)[1]/2); }
    }
    atlas.places[item.id] = item; parent.placeIds.push(item.id);
    if (ENTERABLE.has(type)) { const child = makeBoard(name, type, item.id); atlas.boards[child.id] = child; item.childBoardId = child.id; }
    return item.childBoardId ? atlas.boards[item.childBoardId] : null;
  };
  for (const [name,x,y,biome,island] of [
    ['State Of Kemeia',115,226,'forest',false],
    ['Idrieland',375,156,'highland',false],
    ['Emerald Bay',620,261,'desert',false],
    ['Island Of Crieta',700,0,'forest',true],
  ]) {
    const realm = add(root, 'continent', name, x, y);
    const item = atlas.places[realm.parentPlaceId];
    item.biome = biome; item.island = island;
  }
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
    if (!board.baseMap && ['town', 'village'].includes(board.kind)) board.baseMap = generateTownBase(board.kind, board.name, 'standard');
    if (board.baseMap) validateTownBase(board.baseMap);
    if (board.keepGeography != null && typeof board.keepGeography !== 'boolean') throw new Error('Invalid geography protection');
    for (const placeId of board.placeIds) {
      const place = value.places[placeId];
      if (!place || place.boardId !== board.id || !Object.hasOwn(TYPES, place.type) || !Number.isFinite(place.x) || !Number.isFinite(place.y)) throw new Error('Invalid place data');
      if (place.keepPlace != null && typeof place.keepPlace !== 'boolean') throw new Error('Invalid place protection');
      if (place.type === 'continent') {
        if (!REALM_BIOMES.includes(place.biome)) place.biome = randomRealmBiome(place.name);
        place.island = !!place.island;
      }
      if (place.type === 'house' && board.baseMap && place.baseFootprintIndex == null) {
        const [w,h] = cardSize('house');
        const footprint = nearestTownFootprint(board.baseMap, { x:place.x+w/2, y:place.y+h/2 }, 1000);
        if (footprint) { place.baseFootprintIndex = footprint.index; place.x = Math.round(footprint.x-w/2); place.y = Math.round(footprint.y-h/2); }
      }
      if (place.baseFootprintIndex != null && (!board.baseMap || !Number.isInteger(place.baseFootprintIndex) || place.baseFootprintIndex < 0 || place.baseFootprintIndex >= board.baseMap.layers.buildings.length)) throw new Error('Invalid notable building');
      if (place.events != null && (!Array.isArray(place.events) || place.events.length > 1000 || place.events.some(event => !event || typeof event.id !== 'string' || typeof event.title !== 'string' || typeof event.detail !== 'string' || typeof event.session !== 'string'))) throw new Error('Invalid campaign events');
    }
  }
  value.sessions ||= {};
  value.routes ||= {};
  if (typeof value.routes !== 'object' || Array.isArray(value.routes)) throw new Error('Invalid route data');
  for (const [routeId, route] of Object.entries(value.routes)) {
    if (!route || route.id !== routeId || !value.boards[route.boardId] || !value.places[route.fromPlaceId] || !value.places[route.toPlaceId] ||
        value.places[route.fromPlaceId].boardId !== route.boardId || value.places[route.toPlaceId].boardId !== route.boardId ||
        !value.boards[route.boardId].placeIds.includes(route.fromPlaceId) || !value.boards[route.boardId].placeIds.includes(route.toPlaceId) ||
        route.fromPlaceId === route.toPlaceId || !Object.hasOwn(ROUTE_TYPES, route.type) || typeof route.name !== 'string') throw new Error('Invalid route data');
  }
  return value;
}

let atlas = loadAtlas();
let currentBoardId = atlas.rootBoardId;
let selectedPlaceId = null;
let selectedRouteId = null;
let placingType = null;
let connectMode = false;
let connectFromId = null;
let camera = { x: 0, y: 0, scale: 1 };
let gesture = null;
let saveTimer = null;
let toastTimer = null;
let lastDragEnd = 0;
let layout = buildLayout(atlas);
let layoutDirty = false;
let paintQueued = false;
let visibleCards = new Map();
let visibleRoutes = new Map();
let visibleBoards = new Map();
let flyAnimation = null;
let generatorBoardId = null;
let settlementPreview = null;
let eventDraftPlaceId = null;

function board() { return atlas.boards[currentBoardId]; }
function place(id) { return atlas.places[id]; }
function route(id) { return atlas.routes[id]; }
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
function baseScale() { return defaultCamera().scale; }
function maxScale() { return baseScale() * ZOOM_STEP ** MAX_DEPTH; }
function renderCamera() {
  const depth = levelAtScale(camera.scale, baseScale());
  const names = ['WORLD', 'CONTINENT', 'PROVINCE', 'SETTLEMENT', 'INTERIOR'];
  const whole = Math.min(MAX_DEPTH, Math.floor(depth));
  els.zoomLabel.textContent = whole === MAX_DEPTH ? names[MAX_DEPTH] : `${names[whole]} ${Math.round((depth - whole) * 100)}%`;
  els.zoomLabel.title = `Detail level ${depth.toFixed(2)} of ${MAX_DEPTH}`;
  els.wrap.style.setProperty('--decor-opacity', Math.max(0, 1 - depth * 2).toFixed(2));
  if (!paintQueued) { paintQueued = true; requestAnimationFrame(paintVisible); }
}
function screenToWorld(clientX, clientY) {
  const rect = els.wrap.getBoundingClientRect();
  return { x: (clientX - rect.left - camera.x) / camera.scale, y: (clientY - rect.top - camera.y) / camera.scale };
}
function zoomAt(factor, clientX, clientY) {
  if (flyAnimation) { cancelAnimationFrame(flyAnimation); flyAnimation = null; }
  const old = screenToWorld(clientX, clientY);
  camera.scale = Math.max(baseScale() * 0.65, Math.min(maxScale(), camera.scale * factor));
  const rect = els.wrap.getBoundingClientRect();
  camera.x = clientX - rect.left - old.x * camera.scale;
  camera.y = clientY - rect.top - old.y * camera.scale;
  renderCamera();
}
function centerOnBoard(boardId, animate = true) {
  const rect = layout.boards.get(boardId); if (!rect) return;
  const targetScale = Math.min(maxScale(), baseScale() * ZOOM_STEP ** rect.depth);
  const destination = {
    scale: targetScale,
    x: els.wrap.clientWidth / 2 - (rect.x + rect.width / 2) * targetScale,
    y: els.wrap.clientHeight / 2 - (rect.y + rect.height / 2) * targetScale,
  };
  currentBoardId = boardId; selectedPlaceId = null; selectedRouteId = null; placingType = null;
  connectMode = false; connectFromId = null; updateConnectUI();
  renderNavigation(); renderPalette(); renderInspector(); renderHeader();
  if (!animate) { camera = destination; renderCamera(); return; }
  const from = { ...camera }, started = performance.now();
  if (flyAnimation) cancelAnimationFrame(flyAnimation);
  function tick(now) {
    const t = Math.min(1, (now - started) / 450), eased = t * t * (3 - 2 * t);
    camera.scale = from.scale * (destination.scale / from.scale) ** eased;
    camera.x = from.x + (destination.x - from.x) * eased;
    camera.y = from.y + (destination.y - from.y) * eased;
    renderCamera();
    flyAnimation = t < 1 ? requestAnimationFrame(tick) : null;
  }
  flyAnimation = requestAnimationFrame(tick);
}
function changeBoard(boardId) { centerOnBoard(boardId); }
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
    const label = document.createElement('span'); label.textContent = board().baseMap && type === 'house' ? 'Notable house' : TYPES[type].label;
    button.append(icon, label);
    button.addEventListener('click', () => { placingType = placingType === type ? null : type; connectMode = false; connectFromId = null; updateConnectUI(); renderPalette(); });
    button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/mapmaker-place', type); event.dataTransfer.effectAllowed = 'copy'; });
    els.palette.append(button);
  }
  els.wrap.classList.toggle('placing', !!placingType);
}
function updateConnectUI() {
  els.connect.classList.toggle('active', connectMode);
  els.wrap.classList.toggle('connecting', connectMode);
  els.connect.textContent = !connectMode ? '⌁ Connect places' : connectFromId ? '⌁ Choose destination' : '⌁ Choose first place';
  els.connectInstructions.textContent = !connectMode ? 'Draw roads, trails, rivers, and sea routes between places on the same map.' :
    connectFromId ? `Choose a second place on this map to connect to ${place(connectFromId)?.name || 'the first place'}.` : 'Choose the first place on this map. Press Escape to cancel.';
  for (const card of visibleCards.values()) card.classList.toggle('connect-source', card.dataset.placeId === connectFromId);
}
function renderPlaces() {
  layout = buildLayout(atlas);
  layoutDirty = false;
  els.layer.replaceChildren(); visibleCards = new Map();
  els.routesLayer.replaceChildren(); visibleRoutes = new Map();
  els.terrainLayer.replaceChildren(); visibleBoards = new Map();
  renderCamera();
}
function contextBoardAt(point, depth) {
  if (depth === 0) return atlas.rootBoardId;
  let bestId = null, bestDistance = Infinity;
  for (const [id, rect] of layout.boards) {
    if (rect.depth !== depth) continue;
    const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width);
    const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) { bestDistance = distance; bestId = id; }
  }
  return bestId || currentBoardId;
}
function refreshContext() {
  if (flyAnimation) return;
  const level = levelAtScale(camera.scale, baseScale());
  const depth = Math.min(MAX_DEPTH, Math.floor(level) + (blend(level % 1) > 0.5 ? 1 : 0));
  const center = { x: (els.wrap.clientWidth / 2 - camera.x) / camera.scale, y: (els.wrap.clientHeight / 2 - camera.y) / camera.scale };
  const next = contextBoardAt(center, depth);
  if (next !== currentBoardId) {
    currentBoardId = next; placingType = null;
    if (connectFromId && place(connectFromId)?.boardId !== next) { connectFromId = null; updateConnectUI(); }
    renderNavigation(); renderPalette(); renderInspector(); renderHeader();
  }
  els.hint.hidden = board().placeIds.length > 0 || !!board().baseMap;
}
function makeCard(id) {
  const item = place(id), card = document.createElement('div');
  card.className = `place-card${id === selectedPlaceId ? ' selected' : ''}`;
  card.dataset.type = item.type; card.dataset.placeId = id;
  const notableOnBase = item.type === 'house' && !!atlas.boards[item.boardId]?.baseMap;
  if (notableOnBase) card.classList.add('map-notable');
  card.innerHTML = notableOnBase ? '<svg class="place-art" viewBox="0 0 152 98" aria-hidden="true"><path d="M76 20c-12 0-21 9-21 21 0 17 21 38 21 38s21-21 21-38c0-12-9-21-21-21Z" fill="#863a32" stroke="#f2dbaf" stroke-width="3"/><circle cx="76" cy="41" r="8" fill="#f5e2b8"/></svg>' : artworkForPlace(item);
  const child = atlas.boards[item.childBoardId];
  if (child?.baseMap || child?.countrysideVillageId) {
    card.classList.add('map-preview');
    card.innerHTML = artworkForBoard(child, atlas).replace('<svg ', '<svg class="place-art" ');
  }
  const title = document.createElement('span'); title.className = 'map-label'; title.textContent = item.name;
  card.append(title);
  if (item.events?.length) {
    const badge = document.createElement('span'); badge.className = 'event-badge';
    badge.textContent = `✦ ${item.events.length}`; badge.title = `${item.events.length} campaign events`; card.append(badge);
  }
  card.setAttribute('role', 'button'); card.setAttribute('aria-label', `${TYPES[item.type].label}: ${item.name}`);
  return card;
}
function makeRouteNode(id) {
  const svg = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(svg, 'g');
  group.classList.add('route-group'); group.dataset.routeId = id; group.dataset.type = route(id).type;
  if (route(id).provenance?.kind === 'generator') group.classList.add('generated');
  group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0'); group.setAttribute('aria-label', `Edit connection ${route(id).name}`);
  const line = document.createElementNS(svg, 'path'); line.classList.add('route-line');
  const hit = document.createElementNS(svg, 'path'); hit.classList.add('route-hit');
  const label = document.createElementNS(svg, 'text'); label.classList.add('route-label'); label.textContent = route(id).name;
  group.append(line, hit, label); return group;
}
function paintVisible() {
  paintQueued = false;
  if (layoutDirty) { layout = buildLayout(atlas); layoutDirty = false; }
  const level = levelAtScale(camera.scale, baseScale());
  const lower = Math.floor(level), mix = blend(level - lower);
  const depths = lower === MAX_DEPTH ? [[MAX_DEPTH, 1]] : [[lower, 1 - mix], [lower + 1, mix]];
  const view = {
    left: -camera.x / camera.scale, top: -camera.y / camera.scale,
    right: (els.wrap.clientWidth - camera.x) / camera.scale,
    bottom: (els.wrap.clientHeight - camera.y) / camera.scale,
  };
  const wanted = new Set();
  const wantedRoutes = new Set();
  const wantedBoards = new Set();
  const rootRect = layout.boards.get(atlas.rootBoardId);
  if (rootRect && !(rootRect.x > view.right || rootRect.y > view.bottom || rootRect.x + rootRect.width < view.left || rootRect.y + rootRect.height < view.top)) {
    wantedBoards.add(atlas.rootBoardId);
    let terrain = visibleBoards.get(atlas.rootBoardId);
    if (!terrain) {
      terrain = document.createElement('div'); terrain.className = 'terrain-map world-terrain';
      terrain.innerHTML = artworkForBoard(atlas.boards[atlas.rootBoardId], atlas);
      visibleBoards.set(atlas.rootBoardId, terrain); els.terrainLayer.append(terrain);
    }
    terrain.style.left = `${camera.x + rootRect.x * camera.scale}px`;
    terrain.style.top = `${camera.y + rootRect.y * camera.scale}px`;
    terrain.style.transform = `scale(${camera.scale})`;
    terrain.style.opacity = 1;
  }
  for (const [depth, opacity] of depths) {
    if (opacity < 0.015) continue;
    for (const [boardId, rect] of layout.boards) {
      if (rect.depth !== depth || (!['town', 'village', 'house'].includes(atlas.boards[boardId]?.kind) && !atlas.boards[boardId]?.countrysideVillageId)) continue;
      if (rect.x > view.right || rect.y > view.bottom || rect.x + rect.width < view.left || rect.y + rect.height < view.top) continue;
      wantedBoards.add(boardId);
      let terrain = visibleBoards.get(boardId);
      if (!terrain) {
        terrain = document.createElement('div'); terrain.className = 'terrain-map';
        terrain.innerHTML = artworkForBoard(atlas.boards[boardId], atlas);
        visibleBoards.set(boardId, terrain); els.terrainLayer.append(terrain);
      }
      terrain.style.left = `${camera.x + rect.x * camera.scale}px`;
      terrain.style.top = `${camera.y + rect.y * camera.scale}px`;
      terrain.style.transform = `scale(${camera.scale * rect.scale})`;
      terrain.style.opacity = opacity;
    }
    for (const id of nearbyRoutes(layout, depth, view, 240 / camera.scale)) {
      const rect = layout.routes.get(id); wantedRoutes.add(id);
      let group = visibleRoutes.get(id);
      if (!group) { group = makeRouteNode(id); visibleRoutes.set(id, group); els.routesLayer.append(group); }
      const x1 = camera.x + rect.x1 * camera.scale, y1 = camera.y + rect.y1 * camera.scale;
      const x2 = camera.x + rect.x2 * camera.scale, y2 = camera.y + rect.y2 * camera.scale;
      const path = `M ${x1} ${y1} L ${x2} ${y2}`;
      group.children[0].setAttribute('d', path); group.children[1].setAttribute('d', path);
      group.children[2].setAttribute('x', String((x1 + x2) / 2));
      group.children[2].setAttribute('y', String((y1 + y2) / 2 - 9));
      group.style.opacity = opacity;
      group.children[1].style.pointerEvents = opacity > 0.35 ? 'stroke' : 'none';
      group.setAttribute('tabindex', opacity > 0.35 ? '0' : '-1');
      group.classList.toggle('selected', id === selectedRouteId);
    }
    for (const id of nearbyPlaces(layout, depth, view, 240 / camera.scale)) {
      const rect = layout.places.get(id);
      wanted.add(id);
      let card = visibleCards.get(id);
      if (!card) { card = makeCard(id); visibleCards.set(id, card); els.layer.append(card); }
      const scale = camera.scale * rect.scale;
      card.style.left = `${camera.x + rect.x * camera.scale}px`;
      card.style.top = `${camera.y + rect.y * camera.scale}px`;
      card.style.transform = `scale(${scale})`;
      card.style.opacity = opacity;
      card.style.zIndex = depth;
      card.style.pointerEvents = opacity > 0.35 ? 'auto' : 'none';
      card.tabIndex = opacity > 0.35 ? 0 : -1;
      card.classList.toggle('connect-source', id === connectFromId);
    }
  }
  for (const [id, card] of visibleCards) {
    if (!wanted.has(id)) { card.remove(); visibleCards.delete(id); }
  }
  for (const [id, group] of visibleRoutes) {
    if (!wantedRoutes.has(id)) { group.remove(); visibleRoutes.delete(id); }
  }
  for (const [id, terrain] of visibleBoards) {
    if (!wantedBoards.has(id)) { terrain.remove(); visibleBoards.delete(id); }
  }
  refreshContext();
}
function renderInspector() {
  const item = selectedPlaceId ? place(selectedPlaceId) : null;
  const connection = selectedRouteId ? route(selectedRouteId) : null;
  els.inspector.classList.toggle('open', !!item || !!connection);
  els.inspectorKind.textContent = connection ? 'CONNECTION DETAILS' : 'PLACE DETAILS';
  els.inspectorHeading.textContent = item?.name || connection?.name || 'Select a place';
  els.inspectorEmpty.hidden = !!item || !!connection;
  els.inspectorForm.hidden = !item;
  els.routeForm.hidden = !connection;
  if (connection) {
    els.routeName.value = connection.name;
    els.routeType.value = connection.type;
    els.routeDescription.value = connection.description || '';
    els.routeNotes.value = connection.notes || '';
  }
  if (!item) return;
  $('#keep-place-field').hidden = atlas.boards[item.boardId]?.kind !== 'village';
  $('#keep-place').checked = item.keepPlace !== false;
  renderEvents(item);
  els.name.value = item.name; els.description.value = item.description || ''; els.notes.value = item.notes || '';
  els.type.replaceChildren();
  for (const type of PALETTES[atlas.boards[item.boardId]?.kind] || PALETTES.world) {
    const option = document.createElement('option'); option.value = type; option.textContent = TYPES[type].label; els.type.append(option);
  }
  if (![...els.type.options].some(option => option.value === item.type)) {
    const option = document.createElement('option'); option.value = item.type; option.textContent = TYPES[item.type].label; els.type.append(option);
  }
  els.type.value = item.type;
  els.realmOptions.hidden = item.type !== 'continent';
  if (item.type === 'continent') { els.realmBiome.value = item.biome || 'mixed'; els.realmIsland.checked = !!item.island; }
  els.enter.textContent = 'Zoom into this place ↘';
  els.enter.hidden = !ENTERABLE.has(item.type);
}
function renderEvents(item) {
  if (eventDraftPlaceId !== item.id) {
    for (const id of ['event-title', 'event-detail', 'event-session']) $(`#${id}`).value = '';
    eventDraftPlaceId = item.id;
  }
  const list = $('#place-events'); list.replaceChildren();
  for (const event of item.events || []) {
    const entry = document.createElement('article'); entry.className = 'campaign-event';
    const title = document.createElement('strong'); title.textContent = event.title;
    const session = document.createElement('small'); session.textContent = event.session || 'Campaign event';
    const detail = document.createElement('p'); detail.textContent = event.detail;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Remove event';
    remove.addEventListener('click', () => {
      if (!confirm(`Remove event “${event.title}”?`)) return;
      item.events = item.events.filter(e => e.id !== event.id); renderEvents(item); renderPlaces(); scheduleSave();
    });
    entry.append(session, title, detail, remove); list.append(entry);
  }
  if (!item.events?.length) { const hint = document.createElement('p'); hint.className = 'event-empty'; hint.textContent = 'Pin discoveries and encounters to this place.'; list.append(hint); }
}
function renderHeader() {
  els.title.textContent = board().name;
  els.kind.textContent = `${TYPES[board().kind]?.label || 'Map'} map`.toUpperCase();
  els.wrap.dataset.mapKind = board().kind;
  els.subtitle.textContent = board().baseMap ? 'Double-click a building to name it. Pin events to places; regenerate the surroundings as your story grows.' : board().kind === 'house' ? 'Explore the rooms and pin your discoveries to where they happened.' : 'Scroll to reveal detail across the atlas. Drag to visit neighboring places.';
  els.generateButton.hidden = !['world','town','village','house'].includes(board().kind);
  els.generateButton.textContent = board().kind === 'world' ? '✦ Generate world' : board().kind === 'house' ? '✦ Add rooms' : '✦ Regenerate surroundings';
}
function render() { renderNavigation(); renderPalette(); renderPlaces(); renderInspector(); renderHeader(); renderCamera(); }
function selectPlace(pid) {
  selectedPlaceId = pid;
  selectedRouteId = null;
  for (const card of els.layer.querySelectorAll('.place-card')) card.classList.toggle('selected', card.dataset.placeId === pid);
  for (const group of visibleRoutes.values()) group.classList.remove('selected');
  renderInspector();
}
function selectRoute(id) {
  selectedRouteId = id; selectedPlaceId = null;
  for (const card of visibleCards.values()) card.classList.remove('selected');
  for (const group of visibleRoutes.values()) group.classList.toggle('selected', group.dataset.routeId === id);
  renderInspector();
}
function addPlace(type, x, y, boardId = currentBoardId, footprintIndex = null) {
  if (!TYPES[type]) return;
  const targetBoard = atlas.boards[boardId]; if (!targetBoard || !(PALETTES[targetBoard.kind] || []).includes(type)) return;
  currentBoardId = boardId;
  const item = makePlace(boardId, type, DEFAULT_NAMES[type] || 'New place', Math.round(x), Math.round(y));
  if (footprintIndex !== null) item.baseFootprintIndex = footprintIndex;
  atlas.places[item.id] = item; targetBoard.placeIds.push(item.id); placingType = null;
  if (ENTERABLE.has(type)) { const child = makeBoard(item.name, type, item.id); atlas.boards[child.id] = child; item.childBoardId = child.id; }
  render(); selectPlace(item.id); scheduleSave(); toast(`${TYPES[type].label} added`);
  if (window.innerWidth > 1050) els.name.focus();
}
function generatedBefore(boardId, seed) {
  return atlas.boards[boardId].placeIds.some(pid => place(pid)?.provenance?.kind === 'generator' && place(pid).provenance.seed === seed);
}
function generatorPlan(boardId, seed, size) {
  const target = atlas.boards[boardId];
  return planDetails(target.kind, seed, size, target.placeIds.map(place).filter(Boolean));
}
function updateGeneratorPreview() {
  settlementPreview = null;
  if (!generatorBoardId || !atlas.boards[generatorBoardId]) return;
  const seed = els.generatorSeed.value.trim();
  const target = atlas.boards[generatorBoardId];
  if (target.kind === 'world') {
    els.generatorMapPreview.innerHTML = seed ? artworkForBoard({ ...target, worldSeed: seed }, atlas) : '';
    els.generatorPreview.textContent = seed ? 'Changes the shared coastline and terrain details. Realm positions, landscapes, names and island choices stay in place.' : 'Enter a seed to preview the world.';
    els.generatorApply.disabled = !seed;
    return;
  }
  if (target.kind === 'town' || target.kind === 'village') {
    $('#generator-village-type').disabled = $('#generator-keep-geography').checked;
    let plan;
    try {
      plan = seed ? planSettlement(target, atlas.places, seed, els.generatorSize.value, {
        type: $('#generator-village-type').value, keepGeography: $('#generator-keep-geography').checked,
      }) : null;
    } catch (error) {
      els.generatorMapPreview.replaceChildren(); els.generatorPreview.textContent = error.message;
      els.generatorApply.disabled = true; return;
    }
    settlementPreview = plan;
    const base = plan?.base;
    els.generatorMapPreview.innerHTML = base ? artworkForBoard({ ...target, baseMap: base }, atlas) : '';
    if (base) for (const [pid, index] of Object.entries(plan.indices)) {
      const polygon = base.layers.buildings[index];
      const svg = 'http://www.w3.org/2000/svg', label = document.createElementNS(svg, 'text');
      label.setAttribute('x', polygon.reduce((sum,p)=>sum+p[0],0)/polygon.length);
      label.setAttribute('y', Math.min(...polygon.map(p=>p[1]))-8);
      label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'protected-place-label');
      label.textContent = (plan.positions?.[pid] ? '↔ ' : '◆ ') + place(pid).name; els.generatorMapPreview.firstElementChild.append(label);
    }
    els.generatorPreview.textContent = base ?
      `${base.layers.buildings.length} buildings. ${plan.keptIds?.length ?? Object.keys(plan.indices).length} kept places stay fixed. ${Object.keys(plan.positions || {}).length} places may move (↔); names, interiors, notes and events always stay. ${plan.keepGeography === false ? "New geography previewed." : "Established geography stays."}` :
      'Enter a seed to preview a town.';
    els.generatorApply.disabled = !base;
    return;
  }
  const repeated = seed && generatedBefore(generatorBoardId, seed);
  const plan = seed && !repeated ? generatorPlan(generatorBoardId, seed, els.generatorSize.value) : [];
  const previewPlaces = Object.fromEntries(plan.map((spec, index) => [`preview-${index}`, spec]));
  const previewBoard = { ...target, placeIds: [...target.placeIds, ...Object.keys(previewPlaces)] };
  const previewAtlas = { places: { ...atlas.places, ...previewPlaces } };
  let previewArt = artworkForBoard(previewBoard, previewAtlas).replace('<svg viewBox=', '<svg width="1010" height="630" viewBox=');
  const existingArt = target.placeIds.map(pid => place(pid)).filter(Boolean).map(item =>
    artworkForPlace(item).replace('<svg class="place-art"', `<svg x="${Number(item.x)}" y="${Number(item.y)}" opacity=".55" class="place-art"`)).join('');
  const plannedArt = plan.map(item =>
    artworkForPlace(item).replace('<svg class="place-art"', `<svg x="${item.x}" y="${item.y}" class="place-art"`)).join('');
  els.generatorMapPreview.innerHTML = `<svg viewBox="0 0 1010 630" aria-hidden="true">${previewArt}${existingArt}${plannedArt}</svg>`;
  const houses = plan.filter(item => item.type === 'house').length;
  const rooms = houses ? plan.reduce((count, item, index) => count + (item.type === 'house' ? planDetails('house', `${seed}:${index}`, 'standard').length : 0), 0) : 0;
  els.generatorPreview.textContent = !seed ? 'Enter a seed to preview this layout.' : repeated ?
    'This seed has already been used on this map. Enter a different seed to add another set.' : !plan.length ?
    'There is no open space for more places on this map.' : target.kind === 'house' ?
    `Adds ${plan.length} rooms and connecting passages. Existing rooms stay in place.` :
    `Adds ${plan.length} places, including ${houses} houses with ${rooms} rooms, and connecting paths. Existing places stay in place.`;
  els.generatorApply.disabled = !plan.length;
}
function populateGeneratedBoard(boardId, plan, seed) {
  const target = atlas.boards[boardId];
  const prior = target.placeIds.map(place).filter(Boolean);
  for (const [index, spec] of plan.entries()) {
    let nearest = null, best = Infinity;
    for (const candidate of prior) {
      const distance = (candidate.x - spec.x) ** 2 + (candidate.y - spec.y) ** 2;
      if (distance < best) { best = distance; nearest = candidate; }
    }
    const item = makePlace(boardId, spec.type, spec.name, spec.x, spec.y);
    item.description = spec.description;
    item.provenance = { kind: 'generator', seed, sessionRefs: [] };
    atlas.places[item.id] = item; target.placeIds.push(item.id);
    if (nearest) {
      const type = target.kind === 'house' ? 'passage' : target.kind === 'village' ? 'trail' : 'road';
      const name = type === 'passage' ? 'Doorway' : type === 'trail' ? 'Footpath' : 'Town lane';
      const connection = makeRoute(boardId, nearest.id, item.id, type, name);
      connection.provenance = { kind: 'generator', seed, sessionRefs: [] };
      atlas.routes[connection.id] = connection;
    }
    prior.push(item);
    if (item.type === 'house') {
      const child = makeBoard(item.name, 'house', item.id);
      item.childBoardId = child.id; atlas.boards[child.id] = child;
      const childSeed = `${seed}:${index}`;
      populateGeneratedBoard(child.id, planDetails('house', childSeed, 'standard'), childSeed);
    }
  }
}
function connectPlaces(fromId, toId) {
  const from = place(fromId), to = place(toId);
  if (!from || !to || fromId === toId) { toast('Choose two different places'); return; }
  if (from.boardId !== to.boardId) { toast('Choose places on the same map'); return; }
  const existing = Object.values(atlas.routes).find(item => item.boardId === from.boardId &&
    ((item.fromPlaceId === fromId && item.toPlaceId === toId) || (item.fromPlaceId === toId && item.toPlaceId === fromId)));
  connectMode = false; connectFromId = null; updateConnectUI();
  if (existing) { selectRoute(existing.id); toast('These places are already connected'); return; }
  const item = makeRoute(from.boardId, fromId, toId);
  atlas.routes[item.id] = item;
  renderPlaces(); selectRoute(item.id); scheduleSave(); toast('Connection added');
  if (window.innerWidth > 1050) els.routeName.focus();
}
function enterPlace(target = null) {
  const item = target?.id ? target : place(selectedPlaceId); if (!item || !ENTERABLE.has(item.type)) return;
  if (!item.childBoardId) {
    const child = makeBoard(item.name, item.type, item.id);
    atlas.boards[child.id] = child; item.childBoardId = child.id; scheduleSave();
    renderPlaces();
  }
  centerOnBoard(item.childBoardId);
}
function deletePlace() {
  const item = place(selectedPlaceId); if (!item) return;
  const message = item.childBoardId ? `Delete ${item.name} and its detail map? This cannot be undone.` : `Delete ${item.name}?`;
  if (!confirm(message)) return;
  const removedIds = new Set();
  function removeDescendants(pid) {
    const target = place(pid); if (!target) return;
    if (target.childBoardId) {
      const child = atlas.boards[target.childBoardId];
      if (child) { for (const nestedId of [...child.placeIds]) removeDescendants(nestedId); delete atlas.boards[child.id]; }
    }
    removedIds.add(pid); delete atlas.places[pid];
  }
  atlas.boards[item.boardId].placeIds = atlas.boards[item.boardId].placeIds.filter(pid => pid !== item.id);
  removeDescendants(item.id);
  for (const [rid, connection] of Object.entries(atlas.routes)) {
    if (removedIds.has(connection.fromPlaceId) || removedIds.has(connection.toPlaceId)) delete atlas.routes[rid];
  }
  selectedPlaceId = null; render(); scheduleSave(); toast('Place deleted');
}
function deleteRoute() {
  const item = route(selectedRouteId); if (!item) return;
  if (!confirm(`Delete ${item.name}?`)) return;
  delete atlas.routes[item.id]; selectedRouteId = null;
  renderPlaces(); renderInspector(); scheduleSave(); toast('Connection deleted');
}

function cardAtPoint(clientX, clientY) {
  const cards = [...els.layer.querySelectorAll('.place-card')];
  return cards.reverse().find(card => {
    const rect = card.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}
function addAtScreen(type, clientX, clientY) {
  const world = screenToWorld(clientX, clientY);
  const depth = Math.min(MAX_DEPTH, Math.round(levelAtScale(camera.scale, baseScale())));
  const boardId = contextBoardAt(world, depth), rect = layout.boards.get(boardId);
  if (!rect) return;
  const [width, height] = cardSize(type);
  let localX = (world.x - rect.x) / rect.scale, localY = (world.y - rect.y) / rect.scale;
  let footprintIndex = null;
  if (type === 'house' && atlas.boards[boardId]?.baseMap) {
    const footprint = nearestTownFootprint(atlas.boards[boardId].baseMap, { x: localX, y: localY });
    if (!footprint) { toast('Choose a building footprint for this notable house'); return; }
    const marked = atlas.boards[boardId].placeIds.some(pid => place(pid)?.baseFootprintIndex === footprint.index);
    if (marked) { toast('This building is already marked as notable'); return; }
    localX = footprint.x; localY = footprint.y; footprintIndex = footprint.index;
  }
  addPlace(type, localX - width / 2, localY - height / 2, boardId, footprintIndex);
}
els.wrap.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('.zoom-controls')) return;
  if (flyAnimation) { cancelAnimationFrame(flyAnimation); flyAnimation = null; }
  if (placingType) { addAtScreen(placingType, event.clientX, event.clientY); return; }
  const hitRoute = event.target.closest('.route-hit');
  if (hitRoute) { if (!connectMode) selectRoute(hitRoute.parentElement.dataset.routeId); return; }
  const card = event.target.closest('.place-card') || cardAtPoint(event.clientX, event.clientY);
  if (card) {
    const item = place(card.dataset.placeId); if (!item) return;
    if (connectMode) {
      if (!connectFromId) { connectFromId = item.id; selectPlace(item.id); updateConnectUI(); }
      else connectPlaces(connectFromId, item.id);
      return;
    }
    currentBoardId = item.boardId; renderNavigation(); renderPalette(); renderHeader();
    selectPlace(item.id);
    gesture = { kind: 'place', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, item, card, moved: false };
  } else if (!event.target.closest('.canvas-tip')) {
    if (!connectMode) selectPlace(null);
    gesture = { kind: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: camera.x, y: camera.y };
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
    gesture.moved = true;
    const parentScale = layout.boards.get(gesture.item.boardId)?.scale || 1;
    gesture.item.x = Math.round(gesture.x + dx / (camera.scale * parentScale));
    gesture.item.y = Math.round(gesture.y + dy / (camera.scale * parentScale));
    layoutDirty = true; renderCamera();
    gesture.card.classList.add('dragging'); els.wrap.classList.add('dragging-place');
  }
});
function endGesture(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (gesture.kind === 'place' && gesture.moved) {
    const baseMap = atlas.boards[gesture.item.boardId]?.baseMap;
    if (gesture.item.type === 'house' && baseMap) {
      const [width, height] = cardSize('house');
      const footprint = nearestTownFootprint(baseMap, { x: gesture.item.x + width/2, y: gesture.item.y + height/2 }, 30);
      const marked = footprint && atlas.boards[gesture.item.boardId].placeIds.some(pid => pid !== gesture.item.id && place(pid)?.baseFootprintIndex === footprint.index);
      if (!footprint || marked) {
        gesture.item.x = gesture.x; gesture.item.y = gesture.y;
        toast(marked ? 'This building is already marked as notable' : 'Choose a building footprint for this notable house');
      } else {
        gesture.item.x = Math.round(footprint.x-width/2);
        gesture.item.y = Math.round(footprint.y-height/2);
        gesture.item.baseFootprintIndex = footprint.index;
      }
      layoutDirty = true;
    }
    const terrain = visibleBoards.get(gesture.item.boardId);
    if (terrain) { terrain.remove(); visibleBoards.delete(gesture.item.boardId); }
    renderCamera(); scheduleSave();
  }
  gesture.card?.classList.remove('dragging');
  if (gesture.moved) lastDragEnd = performance.now();
  gesture = null; els.wrap.classList.remove('panning', 'dragging-place');
}
els.wrap.addEventListener('pointerup', endGesture);
els.wrap.addEventListener('pointercancel', endGesture);
els.routesLayer.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const group = event.target.closest('.route-group'); if (!group) return;
  event.preventDefault(); selectRoute(group.dataset.routeId);
});
els.layer.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('.place-card'); if (!card) return;
  event.preventDefault();
  const pid = card.dataset.placeId;
  if (connectMode) {
    if (!connectFromId) { connectFromId = pid; selectPlace(pid); updateConnectUI(); }
    else connectPlaces(connectFromId, pid);
  } else if (event.key === 'Enter' && selectedPlaceId === pid) enterPlace();
  else selectPlace(pid);
});
els.wrap.addEventListener('dblclick', event => {
  const card = event.target.closest('.place-card');
  if (!card) {
    if (board().baseMap && !event.target.closest('.zoom-controls')) addAtScreen('house', event.clientX, event.clientY);
    return;
  }
  selectPlace(card.dataset.placeId); enterPlace();
});
els.wrap.addEventListener('wheel', event => {
  event.preventDefault();
  if (gesture || performance.now() - lastDragEnd < 220) return;
  const rawDelta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? els.wrap.clientHeight : 1);
  if (!rawDelta) return;
  if (flyAnimation) { cancelAnimationFrame(flyAnimation); flyAnimation = null; }
  const delta = Math.max(-160, Math.min(160, rawDelta));
  zoomAt(Math.exp(-delta * 0.0018), event.clientX, event.clientY);
}, { passive: false });
els.wrap.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('text/mapmaker-place')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
els.wrap.addEventListener('drop', event => {
  const type = event.dataTransfer.getData('text/mapmaker-place'); if (!TYPES[type]) return;
  event.preventDefault(); addAtScreen(type, event.clientX, event.clientY);
});

els.name.addEventListener('input', () => {
  const item = place(selectedPlaceId); if (!item) return; item.name = els.name.value || 'Unnamed place';
  if (item.childBoardId) atlas.boards[item.childBoardId].name = item.name;
  els.inspectorHeading.textContent = item.name; renderPlaces(); renderNavigation(); scheduleSave();
});
els.type.addEventListener('change', () => {
  const item = place(selectedPlaceId); if (!item) return;
  const nextType = els.type.value;
  if (nextType === 'house' && atlas.boards[item.boardId]?.baseMap) {
    const footprint = nearestTownFootprint(atlas.boards[item.boardId].baseMap, {x:item.x+76,y:item.y+49});
    if (!footprint || atlas.boards[item.boardId].placeIds.some(pid => pid !== item.id && place(pid)?.baseFootprintIndex === footprint.index)) {
      els.type.value = item.type; toast('Place a notable house on an unmarked building'); return;
    }
    item.baseFootprintIndex = footprint.index; item.x = footprint.x-76; item.y = footprint.y-49;
  } else delete item.baseFootprintIndex;
  item.type = nextType;
  if (item.childBoardId) atlas.boards[item.childBoardId].kind = item.type;
  renderPlaces(); renderInspector(); scheduleSave();
});
$('#keep-place').addEventListener('change', () => {
  const item = place(selectedPlaceId); if (!item) return;
  item.keepPlace = $('#keep-place').checked; scheduleSave();
});
els.realmBiome.addEventListener('change', () => {
  const item = place(selectedPlaceId); if (!item || item.type !== 'continent') return;
  item.biome = els.realmBiome.value; renderPlaces(); scheduleSave();
});
els.realmIsland.addEventListener('change', () => {
  const item = place(selectedPlaceId); if (!item || item.type !== 'continent') return;
  item.island = els.realmIsland.checked; renderPlaces(); scheduleSave();
});
for (const [input, key] of [[els.description, 'description'], [els.notes, 'notes']]) {
  input.addEventListener('input', () => { const item = place(selectedPlaceId); if (item) { item[key] = input.value; scheduleSave(); } });
}
els.connect.addEventListener('click', () => {
  connectMode = !connectMode;
  connectFromId = connectMode && selectedPlaceId ? selectedPlaceId : null;
  placingType = null; renderPalette(); updateConnectUI();
  if (connectMode) toast(connectFromId ? 'Choose a destination' : 'Choose two places to connect');
});
els.routeName.addEventListener('input', () => {
  const item = route(selectedRouteId); if (!item) return;
  item.name = els.routeName.value || 'Unnamed connection';
  els.inspectorHeading.textContent = item.name;
  const label = visibleRoutes.get(item.id)?.children[2]; if (label) label.textContent = item.name;
  visibleRoutes.get(item.id)?.setAttribute('aria-label', `Edit connection ${item.name}`);
  scheduleSave();
});
els.routeType.addEventListener('change', () => {
  const item = route(selectedRouteId); if (!item) return;
  item.type = els.routeType.value;
  const group = visibleRoutes.get(item.id); if (group) group.dataset.type = item.type;
  scheduleSave();
});
for (const [input, key] of [[els.routeDescription, 'description'], [els.routeNotes, 'notes']]) {
  input.addEventListener('input', () => { const item = route(selectedRouteId); if (item) { item[key] = input.value; scheduleSave(); } });
}
$('#delete-route').addEventListener('click', deleteRoute);
els.enter.addEventListener('click', enterPlace);
$('#delete-place').addEventListener('click', deletePlace);
$('#close-inspector').addEventListener('click', () => selectPlace(null));
$('#add-place').addEventListener('click', () => { els.palette.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); toast('Choose a place from the left, then click the map'); });
els.generateButton.addEventListener('click', () => {
  if (!['world','town','village','house'].includes(board().kind)) return;
  generatorBoardId = currentBoardId;
  els.generatorTitle.textContent = board().kind === 'world' ? `Generate ${board().name}` : board().kind === 'house' ? `Fill ${board().name} with rooms` : `Generate ${board().name}`;
  els.generatorIntro.textContent = board().kind === 'world' ?
    'Try a new connected coastline and terrain pattern. Mainland realms remain joined; islands stay separate.' : board().kind === 'house' ?
    'Create a repeatable room layout with passages. Your existing rooms and notes stay where they are.' :
    'Choose the landscape and preview a new layout. Kept places stay fixed. Names, notes, events and interiors are always retained.';
  els.generatorApply.textContent = board().kind === 'world' ? 'Use this world map' : board().kind === 'house' ? 'Add rooms' : 'Use these surroundings';
  $('#generator-size-field').hidden = board().kind === 'world';
  $('#generator-geography-options').hidden = board().kind !== 'village';
  $('#generator-village-type').value = villageType(board().baseMap);
  $('#generator-keep-geography').checked = board().keepGeography !== false;
  els.generatorSeed.value = crypto.randomUUID().slice(0, 8);
  els.generatorSize.value = 'standard';
  updateGeneratorPreview(); els.generatorDialog.showModal(); els.generatorSeed.focus();
});
els.generatorSeed.addEventListener('input', updateGeneratorPreview);
els.generatorSize.addEventListener('change', updateGeneratorPreview);
$('#generator-village-type').addEventListener('change', updateGeneratorPreview);
$('#generator-keep-geography').addEventListener('change', () => {
  if ($('#generator-keep-geography').checked) $('#generator-village-type').value = villageType(atlas.boards[generatorBoardId]?.baseMap);
  updateGeneratorPreview();
});
$('#generator-reroll').addEventListener('click', () => { els.generatorSeed.value = crypto.randomUUID().slice(0, 8); updateGeneratorPreview(); });
$('#generator-close').addEventListener('click', () => els.generatorDialog.close());
$('#generator-cancel').addEventListener('click', () => els.generatorDialog.close());
els.generatorApply.addEventListener('click', () => {
  if (!generatorBoardId || !atlas.boards[generatorBoardId]) return;
  const seed = els.generatorSeed.value.trim();
  const target = atlas.boards[generatorBoardId];
  if (target.kind === 'world') {
    if (!seed) return;
    target.worldSeed = seed;
    els.generatorDialog.close(); generatorBoardId = null;
    renderPlaces(); scheduleSave(); toast('World coastline regenerated');
    return;
  }
  if (target.kind === 'town' || target.kind === 'village') {
    if (!seed) return;
    if (!settlementPreview) return;
    applySettlement(target, atlas.places, settlementPreview);
    els.generatorDialog.close(); generatorBoardId = null;
    render(); scheduleSave(); toast(`${target.baseMap.layers.buildings.length} buildings generated`);
    return;
  }
  if (!seed || generatedBefore(generatorBoardId, seed)) { updateGeneratorPreview(); return; }
  const plan = generatorPlan(generatorBoardId, seed, els.generatorSize.value);
  if (!plan.length) { updateGeneratorPreview(); return; }
  populateGeneratedBoard(generatorBoardId, plan, seed);
  els.generatorDialog.close(); generatorBoardId = null;
  render(); scheduleSave(); toast(`${plan.length} places added to ${board().name}`);
});
$('#village-example').addEventListener('click', () => {
  const villageId = addVillageExample(atlas);
  renderPlaces(); centerOnBoard(villageId); scheduleSave();
  toast('Brackenford: explore the tavern, pin an event, or regenerate the surroundings');
});
$('#event-add').addEventListener('click', () => {
  const item = place(selectedPlaceId); if (!item) return;
  if (!$('#event-title').value.trim()) { $('#event-title').focus(); toast('Give the event a title'); return; }
  addCampaignEvent(item, $('#event-title').value, $('#event-detail').value, $('#event-session').value);
  for (const id of ['event-title','event-detail','event-session']) $(`#${id}`).value = '';
  renderEvents(item); renderPlaces(); scheduleSave(); toast('Event pinned to this place');
});
$('#new-atlas-button').addEventListener('click', () => {
  if (!confirm('Start a new example atlas? This replaces the atlas saved in this browser. Export a backup first if you want to keep it.')) return;
  atlas = starterAtlas(); currentBoardId = atlas.rootBoardId; selectedPlaceId = null; selectedRouteId = null; placingType = null;
  connectMode = false; connectFromId = null; updateConnectUI();
  camera = defaultCamera(); render(); scheduleSave(); toast('New atlas created');
});
$('#rename-board').addEventListener('click', () => {
  const name = prompt('Map name', board().name)?.trim(); if (!name) return;
  board().name = name; if (board().parentPlaceId) { const parent = place(board().parentPlaceId); if (parent) parent.name = name; }
  render(); scheduleSave();
});
$('#zoom-in').addEventListener('click', () => {
  const r = els.wrap.getBoundingClientRect(); zoomAt(1.25, r.left + r.width / 2, r.top + r.height / 2);
});
$('#zoom-out').addEventListener('click', () => {
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
    atlas = next; currentBoardId = atlas.rootBoardId; selectedPlaceId = null; selectedRouteId = null; placingType = null;
    connectMode = false; connectFromId = null; updateConnectUI();
    camera = defaultCamera(); render(); scheduleSave(); toast('Atlas imported');
  } catch (error) { toast('This file is not a valid MapMaker atlas'); }
  finally { els.importInput.value = ''; }
});
const helpDialog = $('#help-dialog');
$('#help-button').addEventListener('click', () => helpDialog.showModal());
$('#help-close').addEventListener('click', () => helpDialog.close());
$('#help-done').addEventListener('click', () => helpDialog.close());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { placingType = null; connectMode = false; connectFromId = null; updateConnectUI(); renderPalette(); selectPlace(null); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    if (selectedRouteId) deleteRoute(); else if (selectedPlaceId) deletePlace();
  }
});
window.addEventListener('resize', () => renderCamera());

camera = defaultCamera(); render(); scheduleSave();
