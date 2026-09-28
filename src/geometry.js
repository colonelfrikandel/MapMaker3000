export const MAP_WIDTH = 1010;
export const MAP_HEIGHT = 630;
export const ZOOM_STEP = 5.5;
export const MAX_DEPTH = 4;
const GRID_SIZE = 220;

export const CARD_SIZE = {
  continent: [250, 178], province: [205, 125], region: [205, 125],
  room: [180, 135], default: [152, 98],
};

export function cardSize(type) { return CARD_SIZE[type] || CARD_SIZE.default; }

export function buildLayout(atlas) {
  const boards = new Map();
  const places = new Map();
  const routes = new Map();
  const byDepth = Array.from({ length: MAX_DEPTH + 1 }, () => []);
  const cells = Array.from({ length: MAX_DEPTH + 1 }, () => new Map());
  const routeCells = Array.from({ length: MAX_DEPTH + 1 }, () => new Map());
  const seen = new Set();
  function visit(boardId, x, y, scale, depth) {
    if (seen.has(boardId) || depth > MAX_DEPTH) return;
    const board = atlas.boards[boardId];
    if (!board) return;
    seen.add(boardId);
    boards.set(boardId, { x, y, scale, depth, width: MAP_WIDTH * scale, height: MAP_HEIGHT * scale });
    for (const id of board.placeIds) {
      const item = atlas.places[id];
      if (!item) continue;
      const [width, height] = cardSize(item.type);
      const rect = { x: x + item.x * scale, y: y + item.y * scale, width: width * scale, height: height * scale, scale, depth, boardId };
      places.set(id, rect);
      byDepth[depth].push(id);
      const cellSize = GRID_SIZE / ZOOM_STEP ** depth;
      for (let gx = Math.floor(rect.x / cellSize); gx <= Math.floor((rect.x + rect.width) / cellSize); gx++) {
        for (let gy = Math.floor(rect.y / cellSize); gy <= Math.floor((rect.y + rect.height) / cellSize); gy++) {
          const key = `${gx},${gy}`;
          if (!cells[depth].has(key)) cells[depth].set(key, new Set());
          cells[depth].get(key).add(id);
        }
      }
      if (item.childBoardId) {
        const childScale = scale * width / MAP_WIDTH;
        visit(item.childBoardId, rect.x, rect.y + (rect.height - MAP_HEIGHT * childScale) / 2, childScale, depth + 1);
      }
    }
  }
  visit(atlas.rootBoardId, 0, 0, 1, 0);
  for (const route of Object.values(atlas.routes || {})) {
    const from = places.get(route.fromPlaceId), to = places.get(route.toPlaceId);
    if (!from || !to || from.boardId !== to.boardId || from.boardId !== route.boardId) continue;
    const x1 = from.x + from.width / 2, y1 = from.y + from.height / 2;
    const x2 = to.x + to.width / 2, y2 = to.y + to.height / 2;
    const rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), x1, y1, x2, y2, depth: from.depth };
    routes.set(route.id, rect);
    const cellSize = GRID_SIZE / ZOOM_STEP ** rect.depth;
    for (let gx = Math.floor(rect.x / cellSize); gx <= Math.floor((rect.x + rect.width) / cellSize); gx++) {
      for (let gy = Math.floor(rect.y / cellSize); gy <= Math.floor((rect.y + rect.height) / cellSize); gy++) {
        const key = `${gx},${gy}`;
        if (!routeCells[rect.depth].has(key)) routeCells[rect.depth].set(key, new Set());
        routeCells[rect.depth].get(key).add(route.id);
      }
    }
  }
  return { boards, places, routes, byDepth, cells, routeCells };
}

export function nearbyPlaces(layout, depth, view, margin = 0) {
  const cellSize = GRID_SIZE / ZOOM_STEP ** depth;
  const ids = new Set();
  for (let gx = Math.floor((view.left - margin) / cellSize); gx <= Math.floor((view.right + margin) / cellSize); gx++) {
    for (let gy = Math.floor((view.top - margin) / cellSize); gy <= Math.floor((view.bottom + margin) / cellSize); gy++) {
      for (const id of layout.cells[depth].get(`${gx},${gy}`) || []) ids.add(id);
    }
  }
  return [...ids].filter(id => intersects(layout.places.get(id), view, margin));
}

export function nearbyRoutes(layout, depth, view, margin = 0) {
  const cellSize = GRID_SIZE / ZOOM_STEP ** depth;
  const ids = new Set();
  for (let gx = Math.floor((view.left - margin) / cellSize); gx <= Math.floor((view.right + margin) / cellSize); gx++) {
    for (let gy = Math.floor((view.top - margin) / cellSize); gy <= Math.floor((view.bottom + margin) / cellSize); gy++) {
      for (const id of layout.routeCells[depth].get(`${gx},${gy}`) || []) ids.add(id);
    }
  }
  return [...ids].filter(id => intersects(layout.routes.get(id), view, margin));
}

export function levelAtScale(scale, baseScale) {
  return Math.max(0, Math.min(MAX_DEPTH, Math.log(scale / baseScale) / Math.log(ZOOM_STEP)));
}

export function blend(t) {
  const x = Math.max(0, Math.min(1, (t - 0.28) / 0.55));
  return x * x * (3 - 2 * x);
}

export function intersects(rect, view, margin = 0) {
  return rect.x + rect.width >= view.left - margin && rect.x <= view.right + margin &&
    rect.y + rect.height >= view.top - margin && rect.y <= view.bottom + margin;
}
