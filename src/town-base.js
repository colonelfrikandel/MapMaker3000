// MapMaker 3000 — GPL-3.0-or-later. See LICENSE.
// Shared town geometry, rendering and compatibility with older imported maps.
const WIDTH = 1010, HEIGHT = 630;
const POLYGON_LAYERS = ['earth', 'water', 'buildings', 'prisms', 'squares', 'greens', 'fields', 'walls'];
const LINE_LAYERS = ['roads', 'rivers', 'planks'];

function finitePoint(value) {
  if (!Array.isArray(value) || value.length < 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) throw new Error('Invalid map coordinate');
  return [value[0], value[1]];
}
function polygons(feature) {
  if (!feature) return [];
  if (feature.type === 'Polygon') return [feature.coordinates?.[0]?.map(finitePoint)];
  if (feature.type === 'MultiPolygon') return feature.coordinates?.map(poly => poly[0]?.map(finitePoint)) || [];
  if (feature.type === 'GeometryCollection') return feature.geometries?.filter(g => g.type === 'Polygon').map(g => g.coordinates?.[0]?.map(finitePoint)) || [];
  throw new Error(`Unsupported ${feature.id} geometry`);
}
function lines(feature) {
  if (!feature) return [];
  if (feature.type !== 'GeometryCollection') throw new Error(`Unsupported ${feature.id} geometry`);
  return feature.geometries?.filter(g => g.type === 'LineString').map(g => ({ points: g.coordinates.map(finitePoint), width: Number.isFinite(g.width) ? g.width : 2 })) || [];
}
const round = value => Math.round(value * 10) / 10;
function escapeXml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function polygonPath(poly) { return poly?.length >= 3 ? `M${poly.map(p => `${p[0]} ${p[1]}`).join('L')}Z` : ''; }
function linePath(points) { return points?.length >= 2 ? `M${points.map(p => `${p[0]} ${p[1]}`).join('L')}` : ''; }

export function normalizeWatabouTown(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 100) throw new Error('Choose a Watabou town GeoJSON export');
  const features = new Map(data.features.map(feature => [feature.id, feature]));
  if (features.get('values')?.generator !== 'mfcg' || !features.has('buildings') || !features.has('districts')) throw new Error('This is not a Medieval Fantasy City Generator export');
  const buildingPolygons = polygons(features.get('buildings')).filter(p => p?.length >= 3);
  if (!buildingPolygons.length || buildingPolygons.length > 5000) throw new Error('Town has no usable building footprints');
  const extent = buildingPolygons.flat();
  const minX = extent.reduce((min,p)=>Math.min(min,p[0]), Infinity), maxX = extent.reduce((max,p)=>Math.max(max,p[0]), -Infinity);
  const minY = extent.reduce((min,p)=>Math.min(min,p[1]), Infinity), maxY = extent.reduce((max,p)=>Math.max(max,p[1]), -Infinity);
  const scale = Math.min(830 / (maxX - minX || 1), 550 / (maxY - minY || 1));
  if (!Number.isFinite(scale) || scale <= 0 || scale > 100) throw new Error('Invalid town extent');
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const project = ([x, y]) => [round(WIDTH / 2 + (x - centerX) * scale), round(HEIGHT / 2 - (y - centerY) * scale)];
  const layers = {};
  for (const id of POLYGON_LAYERS) layers[id] = polygons(features.get(id)).filter(p => p?.length >= 3).map(p => p.map(project));
  for (const id of LINE_LAYERS) layers[id] = lines(features.get(id)).filter(line => line.points.length >= 2).map(line => ({ points: line.points.map(project), width: round(Math.max(.5, line.width * scale)) }));
  const districtFeature = features.get('districts');
  if (districtFeature.type !== 'GeometryCollection') throw new Error('Invalid district geometry');
  layers.districts = districtFeature.geometries.filter(g => g.type === 'Polygon' && g.coordinates?.[0]?.length >= 3).map((g, index) => ({
    id: `district-${index}`, name: typeof g.name === 'string' ? g.name.slice(0, 80) : `District ${index+1}`,
    polygon: g.coordinates[0].map(finitePoint).map(project),
  }));
  const treeFeature = features.get('trees');
  layers.trees = treeFeature?.type === 'MultiPoint' ? treeFeature.coordinates.map(finitePoint).map(project) : [];
  const result = { source: 'watabou-mfcg', version: String(features.get('values').version || ''), layers };
  validateTownBase(result);
  return result;
}

export function validateTownBase(base) {
  if (!base || !['watabou-mfcg', 'mapmaker-generated'].includes(base.source) || typeof base.layers !== 'object') throw new Error('Invalid town base');
  let total = 0;
  const checkPoints = points => {
    if (!Array.isArray(points) || points.length > 2000) throw new Error('Invalid town shape');
    total += points.length;
    if (total > 50000) throw new Error('Town base is too large');
    for (const p of points) if (!Array.isArray(p) || p.length !== 2 || !p.every(v => Number.isFinite(v) && Math.abs(v) < 100000)) throw new Error('Invalid town coordinate');
  };
  for (const id of POLYGON_LAYERS) {
    const shapes = base.layers[id]; if (!Array.isArray(shapes) || shapes.length > 5000) throw new Error('Invalid town polygons');
    for (const shape of shapes) checkPoints(shape);
  }
  for (const id of LINE_LAYERS) {
    const shapes = base.layers[id]; if (!Array.isArray(shapes) || shapes.length > 1000) throw new Error('Invalid town lines');
    for (const shape of shapes) { if (!Number.isFinite(shape.width) || shape.width < 0 || shape.width > 1000) throw new Error('Invalid line width'); checkPoints(shape.points); }
  }
  if (!Array.isArray(base.layers.districts) || base.layers.districts.length > 200) throw new Error('Invalid town districts');
  for (const district of base.layers.districts) { if (typeof district.name !== 'string' || district.name.length > 80) throw new Error('Invalid district name'); checkPoints(district.polygon); }
  checkPoints(base.layers.trees);
  return base;
}

export function townBaseSvg(base) {
  validateTownBase(base);
  const l = base.layers;
  const fill = (id, color, opacity = 1) => `<path d="${l[id].map(polygonPath).join('')}" fill="${color}" opacity="${opacity}"/>`;
  const stroke = (id, color, width, extra = '') => l[id].map(line => `<path d="${linePath(line.points)}" fill="none" stroke="${color}" stroke-width="${width || line.width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`).join('');
  const districtColors = ['#d6c58b','#e2bd70','#b4bd83','#c4af91','#d5bd98','#bac4a0','#b5a680'];
  let svg = `<rect width="1010" height="630" fill="#e3e2d7"/>`;
  svg += fill('earth', '#e3e2d7') + fill('fields', '#d7d3a9') + fill('water', '#5e9fb0');
  // Furrows and hedgerows follow each field's own orientation.
  for (const field of l.fields) {
    if (field.length !== 4) continue;
    for (let i=1;i<8;i++) {
      const t=i/8, a=field[0].map((v,j)=>round(v+(field[1][j]-v)*t)), b=field[3].map((v,j)=>round(v+(field[2][j]-v)*t));
      svg+=`<path d="M${a.join(' ')}L${b.join(' ')}" stroke="#b1aa7a" stroke-width=".8" fill="none"/>`;
    }
    svg+=`<path d="${polygonPath(field)}" stroke="#96a075" stroke-width="1.4" fill="none"/>`;
  }
  for (const [index, district] of l.districts.entries()) svg += `<path d="${polygonPath(district.polygon)}" fill="${districtColors[index % districtColors.length]}" fill-opacity=".86" stroke="#8d896e" stroke-width=".8"/>`;
  svg += fill('greens', '#a5ba81') + fill('squares', '#eee5c6');
  svg += l.rivers.map(line => `<path d="${linePath(line.points)}" fill="none" stroke="#456d73" stroke-width="${line.width+2}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  svg += stroke('rivers', '#65a9ba', null);
  svg += stroke('roads', '#665b50', null) + l.roads.map(line => `<path d="${linePath(line.points)}" fill="none" stroke="#d9d1ba" stroke-width="${Math.max(1,line.width-2)}" stroke-linecap="round"/>`).join('');
  svg += fill('buildings', '#b17858') + `<path d="${l.buildings.map(polygonPath).join('')}" fill="none" stroke="#5b5146" stroke-width=".8"/>`;
  for (const [index,roof] of l.buildings.entries()) {
    if (roof.length!==4) continue;
    const a=roof[0].map((v,j)=>round((v+roof[3][j])/2)),b=roof[1].map((v,j)=>round((v+roof[2][j])/2));
    svg+=`<path d="${polygonPath([roof[0],roof[1],b,a])}" fill="${['#d2ac7d','#c89870','#a9a088'][index%3]}"/><path d="M${a.join(' ')}L${b.join(' ')}" stroke="#654f3c" stroke-width=".8"/>`;
  }
  svg += fill('prisms', '#655f5a') + stroke('planks', '#675f52', null);
  svg += `<path d="${l.walls.map(polygonPath).join('')}" fill="none" stroke="#4e4c49" stroke-width="4" stroke-linejoin="round"/>`;
  svg += l.trees.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#7e9b70" stroke="#607b5d" stroke-width=".8"/>`).join('');
  for (const district of l.districts) {
    const poly = district.polygon;
    const x = round(poly.reduce((sum,p)=>sum+p[0],0)/poly.length), y = round(poly.reduce((sum,p)=>sum+p[1],0)/poly.length);
    svg += `<text x="${x}" y="${y}" text-anchor="middle" class="district-label">${escapeXml(district.name)}</text>`;
  }
  return `<svg viewBox="0 0 1010 630" aria-hidden="true">${svg}</svg>`;
}

export function nearestTownFootprint(base, point, maxDistance = 20) {
  const buildings = base.layers.buildings;
  let best = null, bestDistance = maxDistance * maxDistance;
  for (const [index, polygon] of buildings.entries()) {
    const center = [
      polygon.reduce((sum,p)=>sum+p[0],0)/polygon.length,
      polygon.reduce((sum,p)=>sum+p[1],0)/polygon.length,
    ];
    const distance = (center[0]-point.x)**2 + (center[1]-point.y)**2;
    if (distance < bestDistance) { bestDistance = distance; best = { index, x: center[0], y: center[1] }; }
  }
  return best;
}
