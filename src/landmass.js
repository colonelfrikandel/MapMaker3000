// Seeded terrain contours. Work is bounded by sample count, not world area.
export const MAX_TERRAIN_SAMPLES = 140000;

// Close narrow intrusions into the continent before adding coastal detail.
// Four separable directions approximate a round brush in linear time, so
// this fills the back of a gulf without inflating the whole outer coast.
export function softenInlets(field,nx,ny,step,radius=65) {
  const straight=Math.round(radius*(Math.SQRT2-1)/step);
  const diagonal=Math.round(radius*(1-1/Math.SQRT2)/step);
  const directions=[[1,0,straight],[0,1,straight],[1,1,diagonal],[1,-1,diagonal]];
  let source=field,target=new Float32Array(field.length);
  const indices=new Int32Array(Math.max(nx,ny)),deque=new Int32Array(indices.length);
  for(const maximum of [true,false]) for(const [dx,dy,reach] of directions) {
    if(!reach) continue;
    for(let sy=0;sy<ny;sy++) for(let sx=0;sx<nx;sx++) {
      const px=sx-dx,py=sy-dy;
      if(px>=0 && px<nx && py>=0 && py<ny) continue;
      let length=0;
      for(let x=sx,y=sy;x>=0 && x<nx && y>=0 && y<ny;x+=dx,y+=dy) indices[length++]=y*nx+x;
      let head=0,tail=0,added=0;
      for(let i=0;i<length;i++) {
        while(added<length && added<=i+reach) {
          const value=source[indices[added]];
          while(tail>head && (maximum?source[indices[deque[tail-1]]]<=value:source[indices[deque[tail-1]]]>=value)) tail--;
          deque[tail++]=added++;
        }
        while(head<tail && deque[head]<i-reach) head++;
        target[indices[i]]=source[indices[deque[head]]];
      }
    }
    [source,target]=[target,source];
  }
  return source;
}

function noise(x,y,seed) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const smooth=t=>t*t*(3-2*t);
  const value=(a,b)=>{
    let h=Math.imul(a,374761393)^Math.imul(b,668265263)^seed;
    h=Math.imul(h^(h>>>13),1274126177);
    return ((h^(h>>>16))>>>0)/4294967295*2-1;
  };
  const u=smooth(fx),v=smooth(fy);
  return (value(ix,iy)*(1-u)+value(ix+1,iy)*u)*(1-v)+(value(ix,iy+1)*(1-u)+value(ix+1,iy+1)*u)*v;
}
function area(poly) {
  return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
}

export function terrainContours(realms,seed) {
  if (!realms.length) return {rings:[],samples:0,step:0};
  // A minimum spanning tree gives a branched continental backbone rather
  // than a radial outline or one straight bridge between every pair.
  const edges=[],visited=new Set([0]);
  const best=realms.map(()=>Infinity),parent=realms.map(()=>0);
  let last=0;
  while (visited.size<realms.length) {
    let next=-1;
    for (let i=0;i<realms.length;i++) if (!visited.has(i)) {
      const d=Math.hypot(realms[i].x-realms[last].x,realms[i].y-realms[last].y);
      if (d<best[i]) { best[i]=d;parent[i]=last; }
      if (next<0 || best[i]<best[next]) next=i;
    }
    edges.push([realms[parent[next]],realms[next]]); visited.add(next);last=next;
  }
  const segments=[];
  for (const [a,b] of edges) {
    const length=Math.hypot(b.x-a.x,b.y-a.y) || 1;
    const bend=noise(a.x/300,b.y/300,seed)*Math.min(length*.22,140);
    let previous=a;
    for (let i=1;i<=8;i++) {
      const t=i/8,wave=Math.sin(t*Math.PI)*bend;
      const next={x:a.x+(b.x-a.x)*t-(b.y-a.y)/length*wave,y:a.y+(b.y-a.y)*t+(b.x-a.x)/length*wave};
      segments.push({a:previous,b:next,width:(a.radius+b.radius)*.56});previous=next;
    }
  }
  const points=[...realms,...segments.flatMap(s=>[s.a,s.b])];
  const margin=Math.max(...realms.map(r=>r.radius))*2.2+100;
  let left=Math.min(...points.map(p=>p.x))-margin,top=Math.min(...points.map(p=>p.y))-margin;
  let width=Math.max(...points.map(p=>p.x))-left+margin,height=Math.max(...points.map(p=>p.y))-top+margin;
  let step=Math.max(3.5,Math.sqrt(width*height/(MAX_TERRAIN_SAMPLES*.95)),width/1400,height/1400);
  // Coarse samples on huge worlds also widen protected land corridors.
  // Leave enough exterior sea for those contours to close at every edge.
  const extra=step*8;left-=extra;top-=extra;width+=extra*2;height+=extra*2;
  let nx,ny;
  do { nx=Math.ceil(width/step)+1;ny=Math.ceil(height/step)+1;if(nx*ny>MAX_TERRAIN_SAMPLES) step*=1.02; } while(nx*ny>MAX_TERRAIN_SAMPLES);
  let field=new Float32Array(nx*ny).fill(-10000);
  const core=new Float32Array(nx*ny).fill(-10000);
  // Rasterize only each segment's neighborhood, avoiding samples × realms
  // work for ordinary sparse maps.
  function stamp(a,b,radius,protectedRadius) {
    const reach=radius+100+step*3;
    const x0=Math.max(0,Math.floor((Math.min(a.x,b.x)-reach-left)/step));
    const x1=Math.min(nx-1,Math.ceil((Math.max(a.x,b.x)+reach-left)/step));
    const y0=Math.max(0,Math.floor((Math.min(a.y,b.y)-reach-top)/step));
    const y1=Math.min(ny-1,Math.ceil((Math.max(a.y,b.y)+reach-top)/step));
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy || 1;
    for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) {
      const px=left+x*step-a.x,py=top+y*step-a.y;
      const t=Math.max(0,Math.min(1,(px*dx+py*dy)/length2));
      const distance=Math.hypot(px-dx*t,py-dy*t),i=y*nx+x;
      field[i]=Math.max(field[i],radius-distance);
      core[i]=Math.max(core[i],protectedRadius-distance);
    }
  }
  for (const s of segments) stamp(s.a,s.b,Math.max(s.width,step*3),Math.max(22,step*2));
  for (const r of realms) stamp(r,r,Math.max(r.radius,step*3),Math.max(r.radius*.68,step*2));
  field=softenInlets(field,nx,ny,step);
  for (let y=0;y<ny;y++) for (let x=0;x<nx;x++) {
    const i=y*nx+x;
    if(field[i]<-150) continue;
    const px=left+x*step,py=top+y*step;
    const wx=px+noise(px/210,py/210,seed+1)*65,wy=py+noise(px/210,py/210,seed+2)*65;
    const relief=noise(wx/135,wy/135,seed)*80+noise(wx/48,wy/48,seed+3)*30+
      noise(wx/17,wy/17,seed+4)*12+noise(wx/6,wy/6,seed+5)*4;
    field[i]=Math.max(core[i],field[i]+relief-10);
  }
  return contourField(field,nx,ny,step,left,top);
}

export function contourField(field,nx,ny,step,left,top) {
  // March triangles with shared edge IDs. Closed loops include inland seas;
  // even-odd filling distinguishes these from the outer coastline.
  const vertices=new Map(),links=new Map();
  function crossing(a,b) {
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    if(!vertices.has(key)) {
      const t=field[a]/(field[a]-field[b]);
      vertices.set(key,[left+((a%nx)+((b%nx)-(a%nx))*t)*step,top+(Math.floor(a/nx)+(Math.floor(b/nx)-Math.floor(a/nx))*t)*step]);
    }
    return key;
  }
  function triangle(a,b,c) {
    const ids=[];
    for (const [u,v] of [[a,b],[b,c],[c,a]]) if((field[u]>0)!==(field[v]>0)) ids.push(crossing(u,v));
    if(ids.length!==2) return;
    for(let i=0;i<2;i++) { if(!links.has(ids[i])) links.set(ids[i],[]);links.get(ids[i]).push(ids[1-i]); }
  }
  for(let y=0;y<ny-1;y++) for(let x=0;x<nx-1;x++) {
    const a=y*nx+x,b=a+1,c=a+nx,d=c+1;
    if(Math.min(field[a],field[b],field[c],field[d])>0 || Math.max(field[a],field[b],field[c],field[d])<=0) continue;
    triangle(a,b,d);triangle(a,d,c);
  }
  const used=new Set(),rings=[];
  for(const start of links.keys()) {
    if(used.has(start)) continue;
    const ring=[];let current=start,previous=null;
    while(!used.has(current)) {
      used.add(current);ring.push(vertices.get(current));
      const next=links.get(current).find(id=>id!==previous);previous=current;current=next;
      if(!current) break;
    }
    if(current===start && ring.length>5 && area(ring)>step*step*3) rings.push(ring);
  }
  rings.sort((a,b)=>area(b)-area(a));
  return {rings,samples:nx*ny,step};
}
