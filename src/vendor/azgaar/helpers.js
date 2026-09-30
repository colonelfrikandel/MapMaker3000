// Numeric helpers adapted from Azgaar (MIT; see LICENSE), with local randomness.
export const lim=v=>Math.min(Math.max(v,0),100);
export const mean=a=>a.reduce((sum,v)=>sum+v,0)/a.length;
export const d3Range=n=>Array.from({length:n},(_,i)=>i);
export function leastIndex(a,compare) {
  if(!a.length)return undefined;
  let best=0;for(let i=1;i<a.length;i++)if(compare(a[i],a[best])<0)best=i;
  return best;
}
export function numericHelpers(random) {
  const P=p=>p>=1?true:p<=0?false:random()<p;
  const rand=(min=0,max)=>{if(max===undefined){max=min;min=0;}return Math.floor(random()*(max-min+1))+min;};
  const getNumberInRange=r=>{
    if(typeof r!=='string')return 0;
    if(!Number.isNaN(+r))return ~~r+ +P(+r-~~r);
    const sign=r[0]==='-'?-1:1;
    if(Number.isNaN(+r[0]))r=r.slice(1);
    const range=r.includes('-')?r.split('-'):null;if(!range)return 0;
    const count=rand(parseFloat(range[0])*sign,parseFloat(range[1]));
    return Number.isNaN(count)||count<0?0:count;
  };
  return {P,rand,getNumberInRange};
}
