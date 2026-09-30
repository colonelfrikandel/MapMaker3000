// Adapted from Azgaar Fantasy Map Generator, MIT, Copyright 2017-2024 Max Haniyeu.
// Revision 7940ee81c675befe784f047f92f212aaa031e38b. See LICENSE and README.md.
import Alea from './alea.js';
import {calculateVoronoi} from './voronoi.js';
const rn=(v,d=0)=>Math.round(v*10**d)/10**d;
export function createGrid() {
let random;
class GridModule {
  generate(seed        , width        , height        , cellsDesired = 10000)            {
    random = Alea(seed); // reset PRNG

    const spacing = this.getSpacing(cellsDesired, width, height);
    const boundary = this.getBoundaryPoints(width, height, spacing);

    false && console.time("placePoints");
    const points = this.getJitteredPoints(width, height, spacing);
    false && console.timeEnd("placePoints");

    const { cells, vertices } = calculateVoronoi(points, boundary);

    const graph = {
      spacing,
      cellsX: this.getCellsCount(spacing, width),
      cellsY: this.getCellsCount(spacing, height),
      boundary,
      points,
      cells,
      vertices
    }             ;
    graph.cells.h = new Uint8Array(graph.points.length);

    return graph;
  }

  findCell(x        , y        , graph           )         {
    const { spacing, cellsX, cellsY } = graph;
    return Math.floor(Math.min(y / spacing, cellsY - 1)) * cellsX + Math.floor(Math.min(x / spacing, cellsX - 1));
  }

  /** distance between points before jittering */
          getSpacing(cellsDesired        , width        , height        )         {
    return rn(Math.sqrt((width * height) / cellsDesired), 2);
  }

  /** number of cells fitting the given map dimension */
          getCellsCount(spacing        , size        )         {
    return Math.floor((size + 0.5 * spacing - 1e-10) / spacing);
  }

  /** pseudo-points along the map edge, they clip the outer Voronoi cells but get no cells of their own */
          getBoundaryPoints(width        , height        , spacing        )          {
    const offset = rn(-1 * spacing);
    const bSpacing = spacing * 2;
    const w = width - offset * 2;
    const h = height - offset * 2;
    const numberX = Math.ceil(w / bSpacing) - 1;
    const numberY = Math.ceil(h / bSpacing) - 1;
    const points          = [];

    for (let i = 0.5; i < numberX; i++) {
      const x = Math.ceil((w * i) / numberX + offset);
      points.push([x, offset], [x, h + offset]);
    }

    for (let i = 0.5; i < numberY; i++) {
      const y = Math.ceil((h * i) / numberY + offset);
      points.push([offset, y], [w + offset, y]);
    }

    return points;
  }

  /** points of a square grid, each one randomly shifted within its square */
          getJitteredPoints(width        , height        , spacing        )          {
    const radius = spacing / 2;
    const jittering = radius * 0.9;
    const doubleJittering = jittering * 2;
    const jitter = () => random() * doubleJittering - jittering;

    const points          = [];
    for (let y = radius; y < height; y += spacing) {
      for (let x = radius; x < width; x += spacing) {
        points.push([Math.min(rn(x + jitter(), 2), width), Math.min(rn(y + jitter(), 2), height)]);
      }
    }
    return points;
  }

}

return new GridModule();
}
