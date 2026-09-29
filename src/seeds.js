// Independent namespaces prevent decoration draws from affecting layout draws.
export function seedStream(seed, namespace) {
  let state = 2166136261;
  for (const char of JSON.stringify([String(seed).trim(), namespace])) state = Math.imul(state ^ char.charCodeAt(0),16777619);
  return () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; };
}
