// Shared constraints for generated and saved settlement geography.
export const GEOGRAPHY_LAYERS = ['water','rivers','roads','planks','squares','greens','walls','districts'];
export const VILLAGE_TYPES = ['river', 'crossroads', 'coastal'];
export const roundPoint = (x,y) => [Math.round(x*10)/10, Math.round(y*10)/10];
export function seededRandom(seed) {
  let state=2166136261;
  for(const char of seed) state=Math.imul(state^char.charCodeAt(0),16777619);
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
export function nearestOnSegment(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return [a[0]+t*dx,a[1]+t*dy];
}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function crosses(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0;
}
function segmentDistance(a,b,c,d) {
  if(crosses(a,b,c,d)) return 0;
  return Math.min(distance(a,nearestOnSegment(a,c,d)),distance(b,nearestOnSegment(b,c,d)),distance(c,nearestOnSegment(c,a,b)),distance(d,nearestOnSegment(d,a,b)));
}
export function containsPoint(poly,p) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function polygonDistance(a,b) {
  if(containsPoint(a,b[0])||containsPoint(b,a[0])) return 0;
  let best=Infinity;
  for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) best=Math.min(best,segmentDistance(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));
  return best;
}
export function polygonRoadDistance(poly,roads) {
  let best=Infinity;
  for(const road of roads) for(let j=1;j<road.points.length;j++) {
    if(containsPoint(poly,road.points[j])) return -road.width/2;
    for(let i=0;i<poly.length;i++) best=Math.min(best,segmentDistance(poly[i],poly[(i+1)%poly.length],road.points[j-1],road.points[j])-road.width/2);
  }
  return best;
}
export function clearOfGeography(poly,layers) {
  return poly.every(([x,y])=>x>12&&x<998&&y>12&&y<618)
    && !layers.water.some(w=>polygonDistance(poly,w)<7)
    && polygonRoadDistance(poly,layers.roads)>3
    && ![...layers.squares,...layers.greens].some(p=>polygonDistance(poly,p)<3);
}
export function geographyFor(type,seed) {
  if(!VILLAGE_TYPES.includes(type)) throw new Error('Unknown village geography');
  const rng=seededRandom(`${type}:${seed}`),p=roundPoint;
  const layers={water:[],rivers:[],roads:[],planks:[],squares:[],greens:[],walls:[],districts:[]};
  const road=(points,width=9)=>layers.roads.push({points:points.map(([x,y])=>p(x,y)),width});
  const cx=400+rng()*160,cy=255+rng()*115;
  if(type==='river') {
    const rx=610+rng()*100,amp=18+rng()*26,phase=rng()*4,half=18+rng()*9;
    const riverX=y=>rx+Math.sin(y/125+phase)*amp;
    const bank=Array.from({length:43},(_,i)=>p(riverX(i*15),i*15));
    layers.water.push([...bank.map(([x,y])=>p(x-half,y)),...bank.toReversed().map(([x,y])=>p(x+half,y))]);
    layers.rivers.push({points:bank,width:half});
    const bridge=p(riverX(cy),cy),left=p(cx-150,cy-15),center=p(cx,cy),east=p(bridge[0]+115,cy-20);
    road([[0,cy+40],left,center,bridge,east,[1010,cy-80]],15);
    const north=p(left[0]-35,cy-125),south=p(cx-45,cy+120);
    road([left,north,[north[0]-60-rng()*90,0]]);
    road([center,south,[cx-160,630]]);
    road([north,[cx+10,cy-175],[bridge[0]-65,cy-195]],7);
    road([south,[cx-190,cy+125],[70,540]],7);
    road([east,[east[0]+35,cy+130],[1010,560]],8);
    layers.planks.push({points:[p(bridge[0]-half-12,cy),p(bridge[0]+half+12,cy)],width:21});
    layers.squares.push([p(cx-65,cy-50),p(cx-10,cy-50),p(cx-10,cy-17),p(cx-65,cy-17)]);
  } else if(type==='crossroads') {
    const center=p(cx,cy),west=p(cx-180,cy+20),east=p(cx+180,cy-30),north=p(cx+20,cy-155),south=p(cx-30,cy+145);
    road([[0,cy+85],west,center,east,[1010,cy-70]],16);
    road([[cx-80,0],north,center,south,[cx+40,630]],13);
    road([west,[cx-185,cy-130],north],8);
    road([south,[cx+180,cy+140],east],8);
    road([west,[110,520]],7);
    road([east,[910,100]],7);
    layers.squares.push([p(cx+18,cy+18),p(cx+88,cy+18),p(cx+88,cy+76),p(cx+18,cy+76)]);
    layers.greens.push([p(cx-105,cy-100),p(cx-35,cy-100),p(cx-35,cy-35),p(cx-105,cy-35)]);
  } else {
    const sx=680+rng()*80,phase=rng()*4;
    const shoreX=y=>sx+Math.sin(y/130+phase)*26-45*Math.exp(-(((y-cy)/100)**2));
    const shore=Array.from({length:43},(_,i)=>p(shoreX(i*15),i*15));
    layers.water.push([...shore,[1010,630],[1010,0]]);
    const quay=Array.from({length:7},(_,i)=>p(shoreX(45+i*90)-45,45+i*90));
    road(quay,13);
    const junction=quay[3],market=p(junction[0]-160,junction[1]+20),north=p(market[0]-65,125),south=p(market[0]-35,505);
    road([junction,market,[market[0]-180,market[1]+40],[0,420]],15);
    road([market,north,[north[0]-80,0]],9);
    road([market,south,[south[0]-75,630]],9);
    road([quay[1],north],7);road([quay[5],south],7);
    for(const i of [2,3,4]) layers.planks.push({points:[quay[i],p(shoreX(quay[i][1])+75,quay[i][1])],width:i===3?17:11});
    layers.squares.push([p(junction[0]-105,junction[1]-55),p(junction[0]-25,junction[1]-55),p(junction[0]-25,junction[1]-20),p(junction[0]-105,junction[1]-20)]);
  }
  return {type,layers};
}
