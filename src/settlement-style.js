const palettes={
  forest:{ground:'#89996e',field:'#a9b181',green:'#6f8a59',roof:'#826049',road:'#c3b58b',water:'#739e9d',tree:'#426645'},
  desert:{ground:'#d7bd83',field:'#cbb481',green:'#aca477',roof:'#d9c59e',road:'#e6d2a4',water:'#75a5a0',tree:'#8b9562'},
  snow:{ground:'#e0e6df',field:'#cbd7cf',green:'#b4c7bd',roof:'#b9c9cd',road:'#c4c8bc',water:'#aacbd3',tree:'#527168'},
  wetland:{ground:'#94a284',field:'#abb08b',green:'#788e68',roof:'#80785a',road:'#b6ac86',water:'#799c93',tree:'#58745a'},
  grassland:{ground:'#b4b481',field:'#c5bd88',green:'#93a66e',roof:'#ac8061',road:'#ded0a6',water:'#81a8ae',tree:'#708954'},
  tundra:{ground:'#acb6a3',field:'#b9bda4',green:'#96a48b',roof:'#958878',road:'#cdc5ab',water:'#98b7be',tree:'#718472'},
  alpine:{ground:'#b2b2a0',field:'#bcbba1',green:'#929b81',roof:'#8b8175',road:'#cecab3',water:'#8aadb7',tree:'#657b68'},
};
export function settlementStyle(context) {return context?.surface==='land'?palettes[context.biome]||null:null;}
export function vegetationSvg(points,context) {
  const p=settlementStyle(context),type=p?context.biome:null;
  return points.map(([x,y],i)=>{
    if(p&&((type==='desert'&&i%8)||(type==='tundra'&&i%4)))return '';
    if(p&&['snow','alpine'].includes(type))return `<path d="M${x-4} ${y+3}L${x} ${y-7}L${x+4} ${y+3}Z" fill="${p.tree}" stroke="#526559" stroke-width=".7"/><path d="M${x-2} ${y-2}L${x} ${y-7}L${x+2} ${y-2}" fill="#e6ebe2"/>`;
    if(p&&type==='wetland')return `<path d="M${x-4} ${y+3}h8M${x} ${y+3}v-8m0 6l-3-4m3 4l3-5" fill="none" stroke="${p.tree}" stroke-width="1.2"/>`;
    if(p&&type==='desert')return `<path d="M${x-3} ${y}l3-2 3 2m-3-2v5" fill="none" stroke="${p.tree}" stroke-width="1.3"/>`;
    return `<circle cx="${x}" cy="${y}" r="${type==='forest'?4.5:3.2}" fill="${p?.tree||'#7e9b70'}" stroke="#607b5d" stroke-width=".8"/>`;
  }).join('');
}
export function styleSettlementSvg(svg,context) {
  const p=settlementStyle(context);if(!p)return svg;
  const colors={'#e3e2d7':p.ground,'#d7d3a9':p.field,'#a5ba81':p.green,'#b17858':p.roof,'#d2ac7d':p.roof,'#c89870':p.roof,'#a9a088':p.roof,'#d9d1ba':p.road,'#eee5c6':p.road,'#5e9fb0':p.water,'#65a9ba':p.water};
  svg=svg.replace(/#[0-9a-f]{6}/g,color=>colors[color]||color);
  // Fading the outskirts reveals the surrounding map; buildings stay fixed.
  const id='settlement-edge-'+context.biome;
  const [ground,details='']=svg.split('<!--settlement-ground-end-->');
  return `<defs><radialGradient id="${id}-gradient"><stop offset="65%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1010" height="630"><rect width="1010" height="630" fill="url(#${id}-gradient)"/></mask></defs><g mask="url(#${id})">${ground}</g>${details}`;
}
