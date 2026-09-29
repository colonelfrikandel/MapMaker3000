// Four cardinal anchors describe a circle; sampled geometry is only for display
// and hit testing, never persisted as extra editing handles.
export function curvePoint(points,index,t) {
  const n=points.length,a=points[index],b=points[(index+1)%n],prev=points[(index+n-1)%n],next=points[(index+2)%n];
  const k=.2761423749154,u=1-t;
  return a.map((v,j)=>u*u*u*v+3*u*u*t*(v+(b[j]-prev[j])*k)+3*u*t*t*(b[j]-(next[j]-v)*k)+t*t*t*b[j]);
}
export function sampledRing(points) {
  return points.flatMap((_,i)=>Array.from({length:16},(_,j)=>curvePoint(points,i,j/16)));
}
export function biomeGeometry(region) {
  return region.curved?{...region,curved:false,points:sampledRing(region.points),holes:(region.holes||[]).map(sampledRing),boundaryVersion:2}:region;
}
export function circleAnchors(x,y,r) {return [[x,y-r],[x+r,y],[x,y+r],[x-r,y]];}
