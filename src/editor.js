// Snapshot commands are bounded and retain complete campaign identity.
export function createHistory(initial, {limit = 40, maxBytes = 24000000} = {}) {
  let current = JSON.stringify(initial), undo = [], redo = [], group = null;
  function trim() {
    while (undo.length > limit || (undo.length && undo.reduce((n,c)=>n+2*(c.before.length+c.after.length),0) > maxBytes)) undo.shift();
  }
  return {
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    breakGroup() { group = null; },
    record(atlas, {label = 'Edit atlas', mergeKey = null, manual = true} = {}) {
      if (manual && atlas.schemaVersion === 2) markChanges(JSON.parse(current), atlas);
      const after = JSON.stringify(atlas);
      if (after === current) return false;
      if (mergeKey && mergeKey === group && undo.length) undo.at(-1).after = after;
      else undo.push({before:current, after, label});
      current = after; group = mergeKey; redo = []; trim(); return true;
    },
    undo() {
      const command = undo.pop(); if (!command) return null;
      redo.push(command); current = command.before; group = null;
      return {atlas:JSON.parse(current), label:command.label};
    },
    redo() {
      const command = redo.pop(); if (!command) return null;
      undo.push(command); current = command.after; group = null;
      return {atlas:JSON.parse(current), label:command.label};
    },
  };
}

function markChanges(before, after) {
  for (const collection of ['places','routes']) for (const [id,item] of Object.entries(after[collection] || {})) {
    const old = before[collection]?.[id];
    if (!old) continue;
    const moved = item.x !== old.x || item.y !== old.y;
    const edited = ['name','type','description','notes','biome','island','events'].some(key=>JSON.stringify(item[key]) !== JSON.stringify(old[key]));
    if (!moved && !edited) continue;
    item.editState = edited ? 'manually-edited' : 'manually-moved';
    item.protected = true;
    if (after.boards[item.boardId]?.kind === 'village') item.keepPlace = true;
  }
}

// Captures the exact candidate shown to the user. Applying an obsolete preview
// is rejected rather than overwriting edits made since the preview was created.
export function createPreview(atlas, change, validate = value=>value) {
  const baseline = JSON.stringify(atlas);
  const candidate = structuredClone(atlas);
  change(candidate);
  const result = validate(candidate);
  let active = true;
  return {
    candidate: structuredClone(result),
    cancel() { active = false; },
    apply(current) {
      if (!active) throw new Error('This preview is closed. Generate a new preview.');
      if (JSON.stringify(current) !== baseline) throw new Error('The atlas changed. Generate a new preview before applying.');
      active = false;
      return structuredClone(result);
    },
  };
}

export function isProtected(item) {
  return item.protected === true || ['protected','manually-moved','manually-edited'].includes(item.editState) ||
    (item.provenance?.kind !== 'generator' && item.editState !== 'generated');
}

// Pure merge for future world-layer generators: ordinary generated objects are
// replaceable, while explicit overrides keep their IDs and complete payload.
export function mergeGeneratedLayer(existing, generated) {
  const result = structuredClone(generated);
  for (const [id,item] of Object.entries(existing)) if (isProtected(item)) result[id] = structuredClone(item);
  return result;
}
