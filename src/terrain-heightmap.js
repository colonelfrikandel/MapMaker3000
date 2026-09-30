// Shared sampling for coastlines and physical geography. Azgaar's jittered
// source grid has fixed row spacing; heights are interpolated between centers.
export function sampleTerrainHeight(heightmap,settings,x,y) {
  const width=1400,height=width*settings.height/settings.width;
  const spacing=Math.round(Math.sqrt(width*height/10000)*100)/100;
  const gx=(x-(settings.centerX-settings.width/2))/settings.width*width/spacing-.5;
  const gy=(y-(settings.centerY-settings.height/2))/settings.height*height/spacing-.5;
  const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
  const at=(xx,yy)=>heightmap.values[Math.max(0,Math.min(heightmap.ny-1,yy))*heightmap.nx+Math.max(0,Math.min(heightmap.nx-1,xx))];
  return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
export const terrainElevation=height=>Math.max(0,height-19.5)*60;
