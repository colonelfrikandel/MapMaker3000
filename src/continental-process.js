import { seedStream } from './seeds.js';

function noise(x,y,seed) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const at=(a,b)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295*2-1;};
  return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}

// Geology-inspired shape model: fracture a shared ancestral landmass, move its
// pieces, then erode drainage paths. It is not a physical plate reconstruction.
export function continentalField(seed,settings,nx,ny,step) {
  const random=seedStream(seed,'continental-process-2'),salt=Math.floor(random()*2147483647);
  const {width,height,preset,roughness}=settings;
  const drift=settings.drift??.55,erosion=settings.erosion??.5;
  random(); // Retain the version-2 random stream ordering.
  const rotation=random()*Math.PI*2;
  const count=4+Math.floor(random()*4),plates=[];
  for(let i=0;i<count;i++) {
    let x,y;
    for(let attempt=0;attempt<40;attempt++) {
      x=(random()-.5)*1.5;y=(random()-.5)*1.5;
      if(plates.every(p=>Math.hypot(x-p.x,y-p.y)>.32))break;
    }
    const direction=random()*Math.PI*2,speed=.10+random()*.42;
    plates.push({x,y,dx:Math.cos(direction)*speed,dy:Math.sin(direction)*speed,spin:(random()-.5)*1.2});
  }
  // Different seeds change the continental skeleton, not just coastline noise.
  const lobes=Array.from({length:4+Math.floor(random()*5)},(_,i)=>{
    const a=rotation+i*2.399963,r=i===0?0:.1+random()*.46;
    return {x:Math.cos(a)*r,y:Math.sin(a)*r,rx:.22+random()*.28,ry:.2+random()*.24};
  });
  const opening=drift*(.65+random()*.9)*(preset==='island-heavy'?1.6:preset==='fragmented'?1.15:.8);
  const sx=preset==='north-south'?.62:1,sy=preset==='north-south'?1.15:1;
  const zoom=1/(1+opening*.48),field=new Float32Array(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const u=(x*step/width*2-1)/zoom/sx,v=(y*step/height*2-1)/zoom/sy;
    let heightValue=-1;
    for(let i=0;i<count;i++) {
      const plate=plates[i],a=-plate.spin*opening,c=Math.cos(a),s=Math.sin(a);
      const tx=u-plate.dx*opening-plate.x,ty=v-plate.dy*opening-plate.y;
      const px=plate.x+tx*c-ty*s,py=plate.y+tx*s+ty*c;
      // Shared warped fracture boundaries produce related opposing shorelines.
      const wx=px+noise(px*2.4,py*2.4,salt)*.30+noise(px*9,py*9,salt+8)*.055,wy=py+noise(px*2.4+21,py*2.4-14,salt)*.30+noise(px*9+21,py*9-14,salt+8)*.055;
      const own=(wx-plate.x)**2+(wy-plate.y)**2;
      let boundary=1;
      for(let j=0;j<count;j++)if(j!==i) {
        const q=plates[j],distance=Math.hypot(q.x-plate.x,q.y-plate.y);
        boundary=Math.min(boundary,(((wx-q.x)**2+(wy-q.y)**2)-own)/(2*distance));
      }
      let mass=-1;
      for(const l of lobes)mass=Math.max(mass,(1-Math.hypot((px-l.x)/l.rx,(py-l.y)/l.ry))*.3);
      const coast=noise(px*5,py*5,salt+1)*.075+noise(px*13,py*13,salt+2)*.032+noise(px*37,py*37,salt+3)*.012;
      mass+=coast*(.35+roughness);
      heightValue=Math.max(heightValue,Math.min(mass,boundary+(.018*(1-drift))+coast*.45));
    }
    // Keep an ocean margin without imposing straight clipping edges.
    const margin=.96-Math.max(Math.abs(x*step/width*2-1),Math.abs(y*step/height*2-1));
    field[y*nx+x]=Math.min(heightValue,margin*.5);
  }
  // Route water down the height field. Accumulated flow cuts valleys and river
  // mouths; a local sediment pass rounds the sharpest coastal corners.
  const order=Array.from({length:field.length},(_,i)=>i).sort((a,b)=>field[b]-field[a]);
  const flow=new Float32Array(field.length).fill(1),down=new Int32Array(field.length).fill(-1);
  for(const i of order) {
    if(field[i]<=0)continue;
    const x=i%nx,y=Math.floor(i/nx);let slope=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      if((!dx&&!dy)||x+dx<0||y+dy<0||x+dx>=nx||y+dy>=ny)continue;
      const j=(y+dy)*nx+x+dx,d=(field[i]-field[j])/Math.hypot(dx,dy);
      if(d>slope){slope=d;down[i]=j;}
    }
    if(down[i]>=0)flow[down[i]]+=flow[i];
  }
  if(erosion>0) {
    const eroded=new Float32Array(field);
    for(let i=0;i<field.length;i++)if(down[i]>=0)eroded[i]-=erosion*Math.min(.045,Math.sqrt(flow[i])*.0018);
    for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++) {
      const i=y*nx+x,mean=(eroded[i-1]+eroded[i+1]+eroded[i-nx]+eroded[i+nx])/4;
      field[i]=eroded[i]*(1-erosion*.3)+mean*erosion*.3;
    }
  }
  for(let x=0;x<nx;x++)field[x]=field[(ny-1)*nx+x]=-1;
  for(let y=0;y<ny;y++)field[y*nx]=field[y*nx+nx-1]=-1;
  return {field,history:{version:2,plateCount:count,drift,erosion,stages:['Shared ancestral landmass','Warped rifts and continental drift','Drainage incision and coastal smoothing']}};
}
