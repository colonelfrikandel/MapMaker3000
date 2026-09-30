import { cardSize } from './geometry.js';
import { validateContinentSettings } from './continent.js';
import { validateBiomePolygon } from './biome-editor.js';
import { validateTownBase, nearestTownFootprint } from './town-base.js';
import { generateTownBase } from './town-generator.js';
const TYPES = Object.fromEntries(['world','continent','province','region','town','village','landmark','house','room'].map(key=>[key,true]));
const ROUTE_TYPES = Object.fromEntries(['road','trail','river','sea','passage'].map(key=>[key,true]));
const REALM_BIOMES = ['forest', 'plains', 'highland', 'snow', 'desert', 'marsh', 'coast', 'mixed'];
function randomRealmBiome(name) {
  let value = 2166136261;
  for (const char of name) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return REALM_BIOMES[(value >>> 0) % REALM_BIOMES.length];
}
function validateLegacyStructure(value) {
  if (!record(value) || !record(value.boards) || !record(value.places)) throw new Error('Invalid atlas');
  if (!value || ![1, 2].includes(value.schemaVersion) || typeof value.boards !== 'object' || typeof value.places !== 'object' ||
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
        if (footprint) { place.baseFootprintIndex = footprint.index; /* Preserve legacy coordinates while attaching a footprint. */ }
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

export const ATLAS_VERSION = 2;
export const EDIT_STATES = ['generated', 'protected', 'manually-moved', 'manually-edited'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireRecord = (value, label) => { if (!record(value)) throw new Error(`Invalid ${label}`); };

function metadata(item) {
  item.editState ??= item.provenance?.kind === 'generator' ? 'generated' : 'manually-edited';
  item.protected ??= item.keepPlace ?? item.editState !== 'generated';
  if (!EDIT_STATES.includes(item.editState) || typeof item.protected !== 'boolean') throw new Error('Invalid edit state');
}

function worldFor(atlas, boardId) {
  const seen = new Set();
  while (boardId && !seen.has(boardId)) {
    seen.add(boardId);
    const board = atlas.boards[boardId];
    if (board?.kind === 'world') return boardId;
    boardId = atlas.places[board?.parentPlaceId]?.boardId;
  }
  return null;
}

function validateLayers(atlas) {
  requireRecord(atlas.worlds, 'world layers');
  for (const [id, world] of Object.entries(atlas.worlds)) {
    if (atlas.boards[id]?.kind !== 'world' || world?.id !== id || !['legacy-realms','independent'].includes(world.mode)) throw new Error('Invalid world reference or unsupported generation mode');
    if(world.mode==='independent') {
      if(world.generator?.name!=='continent' || !['1','2','3','4'].includes(world.generator?.version)) throw new Error('Unsupported world generator');
      validateContinentSettings(world.settings);
      if(world.terrainHeightmap!=null) {
        const h=world.terrainHeightmap;
        if(h.version!==1||h.seaLevel!==20||!Number.isInteger(h.nx)||!Number.isInteger(h.ny)||h.nx<1||h.ny<1||h.nx*h.ny>140000||!Array.isArray(h.values)||h.values.length!==h.nx*h.ny||h.values.some(v=>!Number.isInteger(v)||v<0||v>100))throw new Error('Invalid terrain heightmap');
      }
      if(typeof world.seed!=='string' || !world.seed.trim() || world.seed.length>200) throw new Error('Invalid continent seed');
      if(!Object.values(world.geography || {}).some(item=>item?.type==='coastline')) throw new Error('Missing continent coastline');
    } else if (world.generator?.name !== 'realm-contours' || world.generator?.version !== 'gentle-inlets-5') throw new Error('Unsupported world generator');
    if(world.forestStyle!=null&&(!record(world.forestStyle)||!Number.isFinite(world.forestStyle.maxAngle)||world.forestStyle.maxAngle<0||world.forestStyle.maxAngle>89))throw new Error('Invalid forest edge angle');
    for (const layer of ['geography', 'biomes', 'territories']) {
      requireRecord(world[layer], layer);
      for (const [objectId, object] of Object.entries(world[layer])) {
        if (!record(object) || object.id !== objectId) throw new Error('Invalid layer identity');
        metadata(object);
        if (typeof object.type !== 'string') throw new Error('Invalid layer type');
        if (!Array.isArray(object.points) || object.points.length < (object.type==='river'?2:3) || object.points.length > 20000 ||
            object.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) throw new Error('Invalid layer polygon');
        if(object.type==='river' && (!Number.isFinite(object.width)||object.width<=0)) throw new Error('Invalid river width');
        if(object.holes!=null && (!Array.isArray(object.holes)||object.holes.length>2000||object.holes.some(r=>!Array.isArray(r)||r.length<3||r.length>20000||r.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))))) throw new Error('Invalid polygon holes');
        if (layer === 'biomes' && !Number.isFinite(object.priority)) throw new Error('Invalid biome priority');
        if (layer === 'biomes'||layer==='territories') validateBiomePolygon(object);
        if(layer==='territories'&&object.priority!=null&&!Number.isFinite(object.priority))throw new Error('Invalid territory priority');
        if (layer === 'territories' && (atlas.places[object.realmId]?.type !== 'continent' || atlas.places[object.realmId]?.boardId !== id)) throw new Error('Invalid territory realm');
      }
    }
    if(world.biomeDeletions!=null&&(!Array.isArray(world.biomeDeletions)||world.biomeDeletions.length>20000||world.biomeDeletions.some(id=>typeof id!=='string')))throw new Error('Invalid deleted biome IDs');
    if(world.showTerritories!=null&&typeof world.showTerritories!=='boolean')throw new Error('Invalid territory visibility');
    if(world.fields) {
      const f=world.fields,n=f.nx*f.ny;
      if(f.version!==1||typeof f.seed!=='string'||!Number.isInteger(f.nx)||!Number.isInteger(f.ny)||f.nx<2||f.ny<2||n>12000||!Number.isFinite(f.step)||f.step<=0||!Number.isFinite(f.x)||!Number.isFinite(f.y)) throw new Error('Invalid geography grid');
      for(const key of ['land','elevation','temperature','rainfall','filled','downstream']) if(!Array.isArray(f[key])||f[key].length!==n||!f[key].every(Number.isFinite)) throw new Error('Invalid geography field');
      if(f.land.some(v=>v!==0&&v!==1)||f.downstream.some((v,i)=>!Number.isInteger(v)||v< -1||v>=n||v===i||(v>=0&&f.filled[v]>=f.filled[i]))) throw new Error('Invalid drainage graph');
    }
  }
}

// Fill additive metadata on a validated copy. Rendering stays on the existing
// realm generator until an explicit future geography conversion is implemented.
function normalizeV2(atlas) {
  atlas.worlds ??= {};
  requireRecord(atlas.worlds, 'world layers');
  for (const board of Object.values(atlas.boards)) {
    metadata(board);
    if (board.baseMap && !board.generator) board.generator = {
      name: board.baseMap.source, version: String(board.baseMap.version ?? 'legacy')
    };
    if (board.kind === 'world' && !Object.hasOwn(atlas.worlds, board.id)) {
      atlas.worlds[board.id] = { id: board.id, mode: 'legacy-realms',
        generator: { name: 'realm-contours', version: 'gentle-inlets-5' },
        geography: {}, biomes: {}, territories: {} };
    }
  }
  for (const item of Object.values(atlas.places)) {
    // The existing village generator keeps every established place by default.
    if (atlas.boards[item.boardId]?.kind === 'village') item.protected = item.keepPlace !== false;
    metadata(item);
  }
  for (const item of Object.values(atlas.routes)) metadata(item);
  for (const place of Object.values(atlas.places)) {
    if (!['town', 'village'].includes(place.type)) continue;
    const worldBoardId = worldFor(atlas, place.boardId);
    if (worldBoardId && place.environmentRef == null) place.environmentRef = { worldBoardId };
    if (place.environmentRef && place.environmentRef.worldBoardId !== worldBoardId) throw new Error('Invalid settlement environment reference');
  }
  validateLayers(atlas);
  return atlas;
}

export function validateAtlas(input) {
  const atlas = structuredClone(input);
  validateLegacyStructure(atlas);
  requireRecord(atlas.sessions, 'sessions');
  for (const [id, board] of Object.entries(atlas.boards)) {
    if (board.id !== id || new Set(board.placeIds).size !== board.placeIds.length) throw new Error('Invalid board identity');
    if (board.parentPlaceId != null && atlas.places[board.parentPlaceId]?.childBoardId !== id) throw new Error('Invalid parent reference');
  }
  for (const [id, place] of Object.entries(atlas.places)) {
    if (place?.id !== id || !atlas.boards[place.boardId]?.placeIds.includes(id)) throw new Error('Invalid place identity');
    if (place.childBoardId != null && atlas.boards[place.childBoardId]?.parentPlaceId !== id) throw new Error('Invalid child reference');
  }
  return atlas.schemaVersion === 2 ? normalizeV2(atlas) : atlas;
}

export function previewAtlasUpgrade(input) {
  const atlas = validateAtlas(input);
  const fromVersion = atlas.schemaVersion;
  atlas.schemaVersion = ATLAS_VERSION;
  normalizeV2(atlas);
  return { atlas, fromVersion, toVersion: ATLAS_VERSION,
    summary: `${Object.keys(atlas.worlds).length} world(s), ${Object.keys(atlas.places).length} places, ${Object.keys(atlas.routes).length} connections. Adds separate geography, biome and territory collections, edit metadata and settlement environment references. Existing terrain, coordinates, names, interiors, notes, events and sessions are retained. Terrain still uses the current realm-based generator.` };
}

export function serializeAtlas(atlas, spacing) {
  return JSON.stringify(validateAtlas(atlas), null, spacing);
}

