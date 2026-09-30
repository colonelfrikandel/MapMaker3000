// Shared control definitions: add new shape controls here, then consume them in
// the shape model. UI defaults and validation use this same registry.
export const CONTINENT_SLIDERS = [
  {key:'coverage',label:'Land coverage',low:'More ocean',high:'More land',default:.55},
  {key:'fragmentation',label:'Fragmentation',low:'Connected',high:'Separated',default:.15},
  {key:'elongation',label:'Elongation',low:'Compact',high:'Long and narrow',default:.2},
  {key:'coastComplexity',label:'Coast complexity',low:'Smooth',high:'Bays and peninsulas',default:.4},
  {key:'islandAmount',label:'Island amount',low:'None',high:'Many',default:.15},
];
export function shapeControls(settings={}) {
  return {shapeVersion:3,orientation:'horizontal',...Object.fromEntries(CONTINENT_SLIDERS.map(c=>[c.key,c.default])),...settings};
}
