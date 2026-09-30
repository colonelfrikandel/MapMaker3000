import { seedStream } from './seeds.js';

// Broad angular features give a substantial mainland. Fragmentation cuts wide
// straits, independently of the smaller offshore island stream. No river-like
// erosion or high-frequency edge noise is used to shape this coastline.
export function controlledContinentField(seed,settings,nx,ny,step) {
  const random=seedStream(seed,'continent-shape-3');
  const phases=Array.from({length:6},()=>random()*Math.PI*2);
  const sites=Array.from({length:7},(_,i)=>{
    const angle=phases[0]+i*2.399963,r=i===0?0:.28+random()*.45;
    return {x:Math.cos(angle)*r,y:Math.sin(angle)*r};
  });
  const islandsRandom=seedStream(seed,'continent-islands-3');
  const islands=Array.from({length:Math.round(settings.islandAmount*20)},()=>{
    const angle=islandsRandom()*Math.PI*2,r=.72+islandsRandom()*.18;
    return {x:Math.cos(angle)*r,y:Math.sin(angle)*r,radius:.018+islandsRandom()*.025};
  });
  const squeeze=1-settings.elongation*.55;
  const sx=settings.orientation==='vertical'?squeeze:1,sy=settings.orientation==='horizontal'?squeeze:1;
  const field=new Float32Array(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const px=x*step/settings.width*2-1,py=y*step/settings.height*2-1;
    const u=px/sx,v=py/sy,angle=Math.atan2(v,u);
    const broad=Math.sin(angle*2+phases[0])*.09+Math.sin(angle*3+phases[1])*.07;
    const bays=(Math.sin(angle*5+phases[2])*.09+Math.sin(angle*7+phases[3])*.055+Math.sin(angle*11+phases[4])*.025)*settings.coastComplexity;
    const radius=.38+settings.coverage*.38+broad+bays;
    let value=radius-Math.hypot(u,v);
    if(settings.fragmentation>.2) {
      const wx=u+.10*Math.sin(v*5+phases[2])+.035*Math.sin(v*11+phases[4]);
      const wy=v+.10*Math.sin(u*4+phases[3])+.035*Math.sin(u*9+phases[5]);
      let first=Infinity,nearest=null;
      for(const site of sites) {
        const d=(wx-site.x)**2+(wy-site.y)**2;
        if(d<first){first=d;nearest=site;}
      }
      let edge=Infinity;
      for(const site of sites)if(site!==nearest) {
        const d=(wx-site.x)**2+(wy-site.y)**2;
        edge=Math.min(edge,(d-first)/(2*Math.hypot(site.x-nearest.x,site.y-nearest.y)));
      }
      const gap=(settings.fragmentation-.2)*.105;
      value=Math.min(value,edge-gap);
    }
    for(const island of islands)value=Math.max(value,island.radius-Math.hypot(px-island.x,py-island.y));
    // Rounded ocean margin keeps every contour away from the sample boundary.
    field[y*nx+x]=Math.min(value,.96-Math.hypot(px,py));
  }
  for(let x=0;x<nx;x++)field[x]=field[(ny-1)*nx+x]=-1;
  for(let y=0;y<ny;y++)field[y*nx]=field[y*nx+nx-1]=-1;
  return {field,history:{version:3,stages:['Broad mainland','Coastal bays','Fragmentation straits','Offshore islands']}};
}
