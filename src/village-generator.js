// Terrain and connected lanes precede roadside plots. Saved geography can be reused.
import { geographyFor, clearOfGeography, containsPoint, polygonDistance, seededRandom as random } from './settlement-geography.js';
const point = (x,y) => [Math.round(x*10)/10, Math.round(y*10)/10];
function rectangle(x,y,w,h,a) {
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy]) => point(x+sx*w/2*Math.cos(a)-sy*h/2*Math.sin(a),y+sx*w/2*Math.sin(a)+sy*h/2*Math.cos(a)));
}
export function bounds(polygon) {
  return { left: Math.min(...polygon.map(p=>p[0])), right: Math.max(...polygon.map(p=>p[0])), top: Math.min(...polygon.map(p=>p[1])), bottom: Math.max(...polygon.map(p=>p[1])) };
}
export function overlaps(a,b,gap=5) {
  const x=bounds(a), y=bounds(b);
  return x.left < y.right+gap && x.right+gap > y.left && x.top < y.bottom+gap && x.bottom+gap > y.top;
}
export function roadDistance(x,y,roads) {
  let best=Infinity;
  for (const road of roads) for (let i=1;i<road.points.length;i++) {
    const [ax,ay]=road.points[i-1], [bx,by]=road.points[i];
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    best=Math.min(best,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return best;
}

export function generateVillage(seed,size='standard',reserved=[],options={}) {
  const rng=random(`${seed.trim()}:${size}`);
  const geography=options.geography || geographyFor(options.type || 'river',seed.trim());
  const layers={ earth:[],buildings:structuredClone(reserved),prisms:[],fields:[],trees:[],...structuredClone(geography.layers) };
  const avoid=options.avoid || [];
  const free = polygon => clearOfGeography(polygon,layers)
    && ![...layers.buildings,...layers.fields,...avoid].some(other=>overlaps(polygon,other));
  // Walk both sides of every connected lane; frontages follow the street tangent.
  const spacing={small:53,standard:38,large:29}[size];
  for (const road of layers.roads) for (let i=1;i<road.points.length;i++) {
    const [ax,ay]=road.points[i-1], [bx,by]=road.points[i];
    const length=Math.hypot(bx-ax,by-ay), angle=Math.atan2(by-ay,bx-ax);
    for (let d=25;d<length-15;d+=spacing) for (const side of [-1,1]) {
      if (rng()<.16) continue;
      const distance=d+(rng()-.5)*9, depth=15+rng()*10, setback=road.width/2+depth/2+9+rng()*7;
      const x=ax+Math.cos(angle)*distance-Math.sin(angle)*setback*side;
      const y=ay+Math.sin(angle)*distance+Math.cos(angle)*setback*side;
      const polygon=rectangle(x,y,18+rng()*17,depth,angle);
      if (free(polygon)) layers.buildings.push(polygon);
    }
  }
  for (let i=0;i<100;i++) {
    const x=55+rng()*900,y=50+rng()*530;
    if (roadDistance(x,y,layers.roads)<75) continue;
    const field=rectangle(x,y,42+rng()*65,28+rng()*35,(rng()-.5)*.4);
    if (free(field)) layers.fields.push(field);
    if (layers.fields.length>=18) break;
  }
  for (let i=0;i<450;i++) {
    const x=20+rng()*970,y=20+rng()*590;
    if (roadDistance(x,y,layers.roads)<27 || layers.water.some(p=>containsPoint(p,[x,y]))) continue;
    const canopy=rectangle(x,y,12,12,0);
    if (!layers.water.some(p=>polygonDistance(canopy,p)<4) && ![...layers.buildings,...layers.fields,...layers.squares,...layers.greens,...avoid].some(p=>overlaps(canopy,p,3))) layers.trees.push(point(x,y));
  }
  return {source:'mapmaker-generated',version:'3',layout:geography.type,seed,size,layers};
}
