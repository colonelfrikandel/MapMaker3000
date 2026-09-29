import { continentalField } from './continental-process.js';
import { contourField, MAX_TERRAIN_SAMPLES } from './landmass.js';
import { naturalSvg } from './natural-geography.js';
import { territorySvg } from './territories.js';

export const CONTINENT_PRESETS = ['broad','fragmented','north-south','island-heavy'];
export const DEFAULT_CONTINENT = {preset:'broad',width:1400,height:1000,centerX:505,centerY:315,roughness:0.5,drift:0.55,erosion:0.5};

export function validateContinentSettings(settings) {
  if (!settings || !CONTINENT_PRESETS.includes(settings.preset) ||
      !['width','height','centerX','centerY','roughness'].every(key=>Number.isFinite(settings[key])) ||
      settings.width<200 || settings.height<200 || settings.width>1000000 || settings.height>1000000 ||
      Math.abs(settings.centerX)>1e9 || Math.abs(settings.centerY)>1e9 ||
      settings.roughness<0 || settings.roughness>1 || settings.width/settings.height>10 || settings.height/settings.width>10) throw new Error('Choose dimensions from 200 to 1,000,000, an aspect ratio within 10:1, and roughness from 0 to 1.');
  for(const key of ['drift','erosion'])if(settings[key]!=null&&(!Number.isFinite(settings[key])||settings[key]<0||settings[key]>1))throw new Error('Drift and erosion must be from 0 to 1.');
  return settings;
}

// A normalized, seed-only field. No realm or settlement is an input.
export function generateContinent(seed, settings = DEFAULT_CONTINENT) {
  validateContinentSettings(settings);
  if (typeof seed !== 'string' || !seed.trim() || seed.length>200) throw new Error('Enter a continent seed (up to 200 characters).');
  const {width,height,centerX,centerY}=settings;
  const step=Math.max(width/300,height/300,Math.sqrt(width*height/80000));
  const nx=Math.ceil(width/step)+1,ny=Math.ceil(height/step)+1;
  if(nx*ny>MAX_TERRAIN_SAMPLES)throw new Error('Terrain sample budget exceeded');
  const {field,history}=continentalField(seed,settings,nx,ny,step);
  const terrain=contourField(field,nx,ny,step,centerX-width/2,centerY-height/2);
  terrain.history=history;
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
