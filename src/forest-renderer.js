import clip from './polygon-ops.js';
import { seedStream } from './seeds.js';

export const FOREST_STYLE={fill:'#555a48',maxAngle:60,treeHeight:26,spacing:13,interiorDensity:1/9000};
const TREE=new URL('../assets/trees/realm-trees/tree-test.png',import.meta.url).href;
const TOPS=new URL('../assets/trees/realm-trees/tree-tops-test.png',import.meta.url).href;
const n=x=>Math.round(x*100)/100;
const area=r=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const inside=(ring,x,y)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const inPolygon=(rings,x,y)=>inside(rings[0],x,y)&&!rings.slice(1).some(r=>inside(r,x,y));

export function edgeTrees(ring,hole=false,options={}) {
  const style={...FOREST_STYLE,...options},lengths=ring.map((p,i)=>Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1]));
  const total=lengths.reduce((a,b)=>a+b,0);if(!total)return [];
  const count=Math.min(512,Math.max(1,Math.floor(total/style.spacing))),step=total/count;
  const at=distance=>{let d=(distance%total+total)%total;for(let i=0;i<ring.length;i++){if(d<=lengths[i]&&lengths[i]>0){const t=d/lengths[i],a=ring[i],b=ring[(i+1)%ring.length];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}d-=lengths[i];}return ring[0];};
  const winding=Math.sign(area(ring))||1,result=[];
  for(let i=0;i<count;i++) {
    const d=(i+.5)*step,p=at(d),a=at(d-style.treeHeight*.25),b=at(d+style.treeHeight*.25),dx=b[0]-a[0],dy=b[1]-a[1];
    const angle=Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI;
    if(angle>style.maxAngle||Math.hypot(dx,dy)<1e-6)continue;
    const outwardY=-dx*winding*(hole?-1:1);
    result.push({x:p[0],y:p[1],layer:outwardY<0?'back':'front',angle});
  }
  return result;
}

function sprite(x,y,width,height,tops=false) {
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" viewBox="${tops?'35 93 177 64':'59 13 138 213'}" overflow="hidden" aria-hidden="true"><image href="${tops?TOPS:TREE}" width="256" height="256"/></svg>`;
}

export function forestSvg(regions,options={},seed='forest') {
  if(!regions.length)return '';
  const style={...FOREST_STYLE,...options};
  style.maxAngle=Math.max(0,Math.min(89,Number(style.maxAngle)||0));
  const merged=clip.union(...regions.map(r=>[r.points,...(r.holes||[])]));
  const polygons=merged.map(poly=>poly.map(r=>r.slice(0,-1)));
  const path=polygons.map(poly=>poly.map(r=>'M'+r.map(p=>p.map(n).join(' ')).join('L')+'Z').join('')).join('');
  let hash=2166136261;for(const c of path)hash=Math.imul(hash^c.charCodeAt(0),16777619);const clipId='forest-interior-'+(hash>>>0).toString(36);
  const back=[],front=[],interior=[],random=seedStream(String(seed),'forest-layer-1');
  let budget=2000;
  for(const rings of polygons) {
    for(let ri=0;ri<rings.length;ri++)for(const tree of edgeTrees(rings[ri],ri>0,style)) {
      if(budget--<=0)break;
      const h=style.treeHeight*(.88+random()*.24),w=h*138/213;
      const image=sprite(tree.x-w/2,tree.y-h*(tree.layer==='back'?.65:.85),w,h);
      (tree.layer==='back'?back:front).push({y:tree.y,image});
    }
    const bounds=rings[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
    const landArea=Math.abs(area(rings[0]))-rings.slice(1).reduce((sum,r)=>sum+Math.abs(area(r)),0);
    const count=Math.min(80,Math.floor(landArea*style.interiorDensity)),w=style.treeHeight*1.1,h=w*64/177,placed=[];
    for(let attempt=0;attempt<count*30&&placed.length<count;attempt++) {
      const x=bounds[0]+random()*(bounds[2]-bounds[0]),y=bounds[1]+random()*(bounds[3]-bounds[1]);
      if(![[x-w/2,y-h/2],[x+w/2,y-h/2],[x-w/2,y+h/2],[x+w/2,y+h/2],[x,y]].every(p=>inPolygon(rings,...p))||placed.some(p=>Math.hypot(x-p[0],y-p[1])<w*2))continue;
      placed.push([x,y]);interior.push(sprite(x-w/2,y-h/2,w,h,true));
    }
  }
  const ordered=items=>items.sort((a,b)=>a.y-b.y).map(t=>t.image).join('');
  return `<defs><clipPath id="${clipId}"><path d="${path}" clip-rule="evenodd"/></clipPath></defs><g data-forest-layer="back">${ordered(back)}</g><g data-forest-layer="fill"><path d="${path}" fill="${FOREST_STYLE.fill}" fill-rule="evenodd"/></g><g data-forest-layer="interior" clip-path="url(#${clipId})">${interior.join('')}</g><g data-forest-layer="front">${ordered(front)}</g>`;
}
