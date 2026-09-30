export function validateSessionRecords(sessions) {
  for(const [id,s] of Object.entries(sessions)) {
    if(s?.discoveryReview!=null) {
      const review=s.discoveryReview;
      if(typeof review.source!=='string'||review.source.length>400002||!Array.isArray(review.proposals)||review.proposals.length>100)throw new Error('Invalid discovery review');
      const ids=new Set();
      for(const p of review.proposals){
        if(!p||typeof p.id!=='string'||ids.has(p.id)||!['place','biome','route','event'].includes(p.kind)||!['pending','accepted','rejected','applied'].includes(p.status))throw new Error('Invalid discovery proposal');
        ids.add(p.id);
        for(const key of ['type','name','detail','source','from','to','target'])if(typeof p[key]!=='string'||p[key].length>(key==='detail'||key==='source'?200000:500))throw new Error('Invalid discovery text');
        for(const key of ['x','y','radius'])if(p[key]!==null&&!Number.isFinite(p[key]))throw new Error('Invalid discovery position');
        if(p.status==='applied'&&typeof p.resultId!=='string')throw new Error('Invalid discovery result');
      }
    }
    if(!s || s.recordVersion==null)continue; // Preserve earlier session suggestion records.
    if(s.recordVersion!==1 || s.id!==id)throw new Error('Invalid session record');
    for(const [key,max] of [['title',120],['notes',100000],['transcript',200000],['discoveries',100000]])
      if(typeof s[key]!=='string'||s[key].length>max)throw new Error('Invalid session '+key);
    if(!s.title.trim() || typeof s.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !Number.isFinite(Date.parse(s.date)) || new Date(s.date).toISOString().slice(0,10)!==s.date)throw new Error('Enter a valid session title and date');
    if(s.startPlaceId!==null && typeof s.startPlaceId!=='string')throw new Error('Invalid starting place');
    for(const key of ['visitedPlaceIds','discoveryPlaceIds'])if(!Array.isArray(s[key])||s[key].length>10000||s[key].some(id=>typeof id!=='string')||new Set(s[key]).size!==s[key].length)throw new Error('Invalid session links');
  }
}

export function saveSessionRecord(atlas,record) {
  const next=structuredClone(atlas);
  const existing=next.sessions[record.id];
  next.sessions[record.id]={...existing,...structuredClone(record),recordVersion:1,title:record.title.trim()};
  validateSessionRecords(next.sessions);
  return next;
}
