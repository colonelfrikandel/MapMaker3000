import { contourField, MAX_TERRAIN_SAMPLES } from './landmass.js';
import { seedStream } from './seeds.js';
import { naturalSvg } from './natural-geography.js';
import { territorySvg } from './territories.js';

export const CONTINENT_PRESETS = ['broad','fragmented','north-south','island-heavy'];
export const DEFAULT_CONTINENT = {preset:'broad',width:1400,height:1000,centerX:505,centerY:315,roughness:0.5};

export function validateContinentSettings(settings) {
  if (!settings || !CONTINENT_PRESETS.includes(settings.preset) ||
      !['width','height','centerX','centerY','roughness'].every(key=>Number.isFinite(settings[key])) ||
      settings.width<200 || settings.height<200 || settings.width>1000000 || settings.height>1000000 ||
      Math.abs(settings.centerX)>1e9 || Math.abs(settings.centerY)>1e9 ||
      settings.roughness<0 || settings.roughness>1 || settings.width/settings.height>10 || settings.height/settings.width>10) throw new Error('Choose dimensions from 200 to 1,000,000, an aspect ratio within 10:1, and roughness from 0 to 1.');
  return settings;
}

// A normalized, seed-only field. No realm or settlement is an input.
export function generateContinent(seed, settings = DEFAULT_CONTINENT) {
  validateContinentSettings(settings);
  if (typeof seed !== 'string' || !seed.trim() || seed.length>200) throw new Error('Enter a continent seed (up to 200 characters).');
  const random=seedStream(seed,'continent-v1'), phases=Array.from({length:8},()=>random()*Math.PI*2);
  const {width,height,centerX,centerY,preset,roughness}=settings;
  const step=Math.max(width/350,height/350,Math.sqrt(width*height/100000));
  const nx=Math.ceil(width/step)+1,ny=Math.ceil(height/step)+1;
  if(nx*ny>MAX_TERRAIN_SAMPLES) throw new Error('Terrain sample budget exceeded');
  const left=centerX-width/2,top=centerY-height/2,field=new Float32Array(nx*ny);
  const ellipse=(x,y,cx,cy,rx,ry)=>1-Math.hypot((x-cx)/rx,(y-cy)/ry);
  const isles=Array.from({length:13},(_,i)=>{
    const angle=i*Math.PI*2/13+random()*.15;
    return {x:Math.cos(angle)*(.68+random()*.08),y:Math.sin(angle)*(.68+random()*.08),r:.045+random()*.035};
  });
  for(let y=0;y<ny;y++) for(let x=0;x<nx;x++) {
    const u=x*step/width*2-1,v=y*step/height*2-1;
    let value;
    if(preset==='north-south') value=Math.max(ellipse(u,v,-.04,-.27,.28,.46),ellipse(u,v,.05,.25,.20,.55));
    else if(preset==='fragmented') {
      value=ellipse(u,v,0,0,.67,.53);
      for(let i=0;i<5;i++) {
        const a=phases[0]+i*Math.PI*2/5;
        value=Math.max(value,ellipse(u,v,Math.cos(a)*.52,Math.sin(a)*.48,.28,.23));
      }
      value-=.13*(Math.sin(u*17+phases[1])+Math.cos(v*19+phases[2]));
    } else if(preset==='island-heavy') {
      value=ellipse(u,v,0,0,.43,.47);
      for(const isle of isles) value=Math.max(value,ellipse(u,v,isle.x,isle.y,isle.r,isle.r)*.3);
    } else value=Math.max(ellipse(u,v,0,-.14,.66,.57),ellipse(u,v,.06,.32,.29,.49));
    const detail=Math.sin(u*9+phases[3])*Math.cos(v*11+phases[4])*.13+
      Math.sin(u*25+v*7+phases[5])*Math.cos(v*23+phases[6])*.055+
      Math.sin(u*63+phases[7])*Math.cos(v*59+phases[1])*.02;
    field[y*nx+x]=(x===0||y===0||x===nx-1||y===ny-1) ? -1 : value+detail*(.25+roughness);
  }
  const terrain=contourField(field,nx,ny,step,left,top);
  if(!terrain.rings.length) throw new Error('No land generated. Try a different seed.');
  return terrain;
}

const cache=new WeakMap();
export function independentShape(world) {
  if(cache.has(world)) return cache.get(world);
  const landRings=Object.values(world.geography).filter(item=>item.type==='coastline').map(item=>item.points);
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const ring of landRings) for(const [x,y] of ring) {
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  const shape={land:landRings[0] || [],landRings,islands:[],
    lakes:Object.values(world.geography).filter(item=>item.type==='lake'),
    bounds:{x:left-50,y:top-50,width:right-left+100,height:bottom-top+100}};
  cache.set(world,shape);return shape;
}

export function continentSvg(world) {
  const shape=independentShape(world),b=shape.bounds;
  const paths=shape.landRings.map(points=>'M'+points.map(p=>p.map(v=>Math.round(v*10)/10).join(' ')).join('L')+'Z').join('');
  let hash=2166136261;for(const char of paths)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const clip=`natural-land-${(hash>>>0).toString(36)}`;
  return `<svg viewBox="${b.x} ${b.y} ${b.width} ${b.height}" style="background:#7f9dae" aria-hidden="true"><defs><clipPath id="${clip}"><path d="${paths}" clip-rule="evenodd"/></clipPath></defs><path d="${paths}" fill="#b9b693" fill-rule="evenodd"/><g clip-path="url(#${clip})">${naturalSvg(world)}${territorySvg(world)}</g><path d="${paths}" fill="none" stroke="#405450" stroke-width="4" stroke-linejoin="round"/><path d="${paths}" fill="none" stroke="#ebe2bb" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
