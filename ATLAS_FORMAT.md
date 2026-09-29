# Atlas format, version 2

The world editor supports legacy realm-based terrain and independent continents
with natural geography, biome polygon editing and independent political borders.

## Compatibility and upgrade

- `validateAtlas(input)` validates a copy and accepts versions 1 and 2. Version 1
  loading does not upgrade the schema. Missing legacy collections and footprint
  references are normalized without changing house coordinates.
- `previewAtlasUpgrade(input)` returns a separate version 2 atlas and a readable
  summary. The UI applies that copy only after **Upgrade format** is clicked.
  Cancel and Escape discard the preview. New atlases start at version 2.
- `serializeAtlas(atlas)` validates and normalizes a copy for saving/export.
  Existing browser storage keys stay unchanged so previous atlases are found.
- Names, IDs, coordinates, nested boards, routes, notes, events, sessions,
  provenance and saved settlement geometry survive the upgrade. Unknown fields
  are retained. Unsupported schema/generator modes are rejected.
- Export before upgrading if an older-app-compatible copy is needed. Older app
  versions only understand version 1. No downgrade conversion is supplied.

## World layers

`atlas.worlds` is keyed by the existing world board ID:

```json
{
  "world-board-id": {
    "id": "world-board-id",
    "mode": "legacy-realms",
    "generator": { "name": "realm-contours", "version": "gentle-inlets-5" },
    "geography": {},
    "biomes": {},
    "territories": {}
  }
}
```

These collections start empty: migration does not invent border polygons or
approximate existing biome gradients. Legacy terrain still reads the board's
`worldSeed` (or existing name fallback), realm coordinates, and biome/island
settings. Generator metadata identifies that algorithm; it is not a second seed
source. Independent terrain conversion has a geometry preview and an explicit
apply action before changing `mode`.

Independent worlds use `mode: "independent"`, generator
`{ "name": "continent", "version": "1" }`, a `seed`, and `settings` containing
`preset`, `width`, `height`, `centerX`, `centerY`, and `roughness`. Presets are
`broad`, `fragmented`, `north-south`, and `island-heavy`. Settings never read realm
positions. Dimensions range from 200 to 1,000,000 with aspect ratio at most 10:1.
Centers support negative coordinates; sampling stays below 140,000 samples.

Contour rings are saved as `geography` records of type `coastline`, with stable
IDs, provenance and edit metadata. Even-odd fill preserves holes and disconnected
land. Saved rings are authoritative for rendering, surface lookup and camera
bounds; loading does not regenerate them. Protected/manual coastlines and other
world layers survive regeneration.

`previewContinent` upgrades version 1 on the isolated candidate when needed,
retains campaign locations, and reports realm centers lying in water. Applying
is one undoable command. Restoring legacy terrain uses Undo or an older export,
rather than a destructive mode toggle. Coastlines and biome polygons render in
independent mode; territory rendering remains a future step.

### Natural geography

`world.fields` stores natural-generator version 1, geography seed, grid origin
`x/y`, sample spacing `step`, dimensions `nx/ny`, and row-major `land`, `elevation`,
`temperature`, `rainfall`, `filled`, and `downstream` arrays. The grid is bounded
to 12,000 samples regardless of world area. Elevation is expressed in approximate
meters, temperature in Celsius and rainfall as approximate annual millimeters.
These are procedural worldbuilding fields, not calibrated climate simulation.

Latitude derives from north/south position within the actual saved coastline
bounds. Elevation reduces temperature. Prevailing westerly winds, ridge uplift
and leeward moisture loss influence rainfall. Drainage uses a priority flood:
`filled` is the routed water surface, `downstream` indexes a strictly lower cell,
and ocean cells terminate at -1. Depressions become lakes rather than dry uphill
river segments. Runoff accumulation selects connected river reaches.

Natural `geography` records include mountain and lake polygons and river lines.
River `points` accept two or more vertices and require a positive `width`.
Polygon records can include `holes`. Lake `outletCell` and `surfaceLevel`, and
river `cells`, document their generating grid; for protected overrides these
remain historical provenance when a later grid replaces the original.

Initial biome records have stable IDs, priority 0 and generated edit metadata.
Classification uses temperature, rainfall, elevation and water proximity.
Rendering orders biomes by priority, then ID for deterministic ties, and clips
all natural features to land. Manual/protected records survive the generated
layer merge. Field values describe generated geography; they do not yet simulate
the hydrological effects of manually overridden rivers or lakes.

Geography-only regeneration retains the coast seed/settings, and stores its own
seed in `fields`. Changing coast without generating new natural geography drops
obsolete generated fields/features while retaining protected overrides. No
generation runs on loading older independent worlds; open a preview to add it.

Polygon records use stable `id` keys, a `type`, finite `[x,y]` `points` in world
board coordinates, `editState`, `protected`, and optional `provenance`. Biomes
also require numeric `priority`; territories require `realmId`, referencing a
realm on the same world board. Natural geography and biomes render independently;
biome and territory polygons share the Pen editor.
Continuous elevation/climate grids and river lines use the schemas above.

### Biome edits

The editor validates finite, non-degenerate simple polygons and rejects crossing,
touching or backtracking edges. Holes must stay inside their outer boundary and
cannot overlap one another. The same validation runs on imported biome records.
Point/region dragging uses a temporary draft and commits only at pointer-up;
Escape or pointer cancellation discards the draft. All committed changes use
the atlas history as one action, including insertion, deletion and duplication.

Edited regions retain their provenance and receive
`editState: "manually-edited"` and `protected: true`. New/duplicated regions get
new IDs and manual provenance; duplicates also record `copiedFrom`. The UI uses
the same priority/ID ordering as rendering when selecting overlapping regions.

`world.biomeDeletions` stores deleted IDs as regeneration exclusions. These
tombstones survive export/import and are part of undo history; generated regions
with those IDs cannot reappear during a subsequent geography regeneration.

Generated biome boundaries use simplified, rounded polygon rings marked with
`boundaryVersion: 2`. Compatible same-type regions are unioned; lower-priority
geometry is clipped against allocated areas to avoid overlap. Merging may remove
redundant IDs; splitting assigns part IDs. Protected records remain exact during
regeneration. Older generated polygons are smoothed in a derived display cache;
loading alone does not rewrite saved geometry. The explicit Smooth & merge areas
action persists cleanup and protection as one undoable command. Screen-spaced
handles limit visual clutter while retaining original vertex indices. Soft color
transitions and curved water rendering are display effects; saved drainage cells
and climate fields remain unchanged.

### Political territories

Territory records use `type: "territory"`, a same-world `realmId`, polygon
`points`, optional `holes`, edit metadata and optional numeric `priority`
(default 0). Display and selection use the same priority/ID ordering as biomes.
Multiple regions can refer to one realm. `world.showTerritories` defaults to
true and controls the political overlay without altering any terrain data.

Political editing uses the shared draft/validation/history workflow. Borders
can cross ecological regions; geography regeneration preserves all territory
records. Realm association does not modify atlas navigation, settlement
coordinates, interiors or ownership. Reassigning a territory changes only its
realm reference. Deleting a realm deletes its territories in the same command;
changing its type requires clearing/reassigning those references first.

## Settlements and editing metadata

Settlement places keep their existing identity and child board. Their additive
`environmentRef.worldBoardId` identifies the world to sample later. No copied
coordinates or cached biome value is introduced. Sampling will use nested board
transforms in step 7.

Boards, places and routes gain `editState` and `protected`. Supported edit states
are `generated`, `protected`, `manually-moved`, and `manually-edited`. Existing
generator provenance defaults to `generated`; other content defaults to
`manually-edited`. Existing village `keepPlace` behavior remains authoritative
and is reflected in `protected`. Saved settlement boards also record generator
name/version from their base map. Original provenance fields are retained.

Manual place/route edits now update edit state and protection; moving a place
marks it manually moved. Editing a village place re-enables `keepPlace`; explicitly
unchecking that option allows relocation again. The settlement generator retains
its established `keepPlace`/`keepGeography` rules. `mergeGeneratedLayer` supplies
the protected/manual override merge for future world-layer generators.

## Editing transactions

`src/editor.js` provides bounded snapshot commands (40 actions, approximately
24 MB of serialized UTF-16 payload), grouped typing, undo/redo, and isolated
preview transactions. Preview apply checks its original atlas baseline and
rejects stale or already-closed transactions. History is session-only; it is not
stored in atlas exports. Generator apply, import and schema conversion do not
mark generated differences as manual edits.

Settlement vegetation, fields and building placement use independent named
random streams. Existing saved geometry remains authoritative. New village
generation is version 4 and town generation is version 2; `decorationSeed` is
stored with each new base map. World contours already use a separate random
path from their decorative rendering and remain unchanged in this step.

## Verification

`npm test` covers non-mutating previews, idempotent upgrades, unchanged world
artwork and nested layout, JSON round trips, campaign preservation through
settlement regeneration, legacy missing fields, independent polygon storage,
and rejection of invalid references, coordinates, and unsupported versions.

### Manually placed curved biomes

The world-generation UI now requests land only. The optional natural-generation
API remains for legacy fixtures; it is not exposed in the UI. Applying land-only
generation removes automatic biomes, water, mountains and fields, while keeping
manual overrides.

Dropped biomes store four cardinal anchors in `points`, `curved: true`, and
`boundaryVersion: 2`. Closed cubic curves are sampled only for rendering, overlap
clipping and hit testing. Editing never replaces saved anchors with sampled
vertices. Double-click inserts an anchor on the selected curved edge. Curve and
control polygon validation reject crossings. Add, move, insert and delete use
the same undo history and export format as other biome edits. The earlier
Smooth & merge control is superseded by this sparse-anchor workflow.

### Live environment sampling

`samplePlaceEnvironment` derives the rendered center of a place in world-board
coordinates using the shared nested layout. It samples visible biome geometry
(including curved areas, priority and holes), coastline/lake surface, nearby
water and route lines, and optional saved field values. Proximity uses half
the place width clamped to 2–40 world units. Resources are biome-based potential
resources, not campaign facts. Unassigned land has no inferred biome or climate.
No sampled result is persisted; moving a parent place or editing a biome
changes the next sample. Legacy worlds return no environment context.

### Settlement styling

Town and village artwork samples the parent settlement center on each render.
Fixed biome palettes and vegetation glyphs are derived display data, not new
saved terrain or buildings. Ground fades at map edges; roads, buildings and
water retain their geometry. Desert courtyard marks are roof decoration.
No layout or architecture semantics are inferred into campaign records.
The same saved map and context yield the same SVG. Preview, moving a place,
biome editing, reload and undo use the same rendering path.

### Reviewed session suggestions

Accepted reviews create a `sessions[id]` record with name, selected place ID,
source text, timestamp and accepted suggestion IDs. Appended notes retain
`noteSources`; events and biome circles have `session-suggestion` provenance
with sessionId, sourceText and acceptedAt. The English keyword parser operates
on one user-selected place, offers no preselected changes, and suppresses
ambiguous or negated biome matches. Biome suggestions create a protected
four-anchor circle, radius 60 world units, above existing priorities.
Apply uses a validated snapshot preview; stale previews are rejected and
Cancel changes nothing. Undo/redo includes the session and every accepted edit.

### Continental process generator version 2

New coastline previews use `continent-2` provenance and world generator version
`2`; version `1` saved geometry remains supported without rerolling. Settings
may include `drift` and `erosion` in [0,1], defaulting to 0.55 and 0.5 for older
settings. `landformHistory` records algorithm version, continental block count,
controls and generation stages. It describes a procedural construction process,
not geological dates or a physically simulated history.

A shared irregular ancestral field is partitioned by noise-warped nearest-block
boundaries. Each block is translated/rotated before reassembly. Downhill flow
accumulation incises the scalar field; local smoothing rounds coastal corners.
Only bounded marching contours and process metadata are saved, not automatic
biomes, rivers or elevation grids. Changing seed varies the underlying skeleton
and block motion. Keep existing coastline retains its geometry and provenance.

### Four-layer forest rendering

Forest sprites are derived from the displayed, unioned forest geometry. The
original PNG files remain unchanged. Layer order is back trees, solid #555a48
fill with even-odd holes, sparse interior treetop PNGs clipped to the region,
then front trees. Local boundary tangents determine eligibility; winding and
hole status determine front/back. Sprites stay upright. Sampling and counts
are bounded, and a seeded stream keeps placement stable across reloads.
Optional `world.forestStyle.maxAngle` stores a finite value from 0 to 89 degrees
relative to horizontal, default 60. Editor changes are one undoable action.
Sprite dimensions, spacing and interior density live in FOREST_STYLE in
`src/forest-renderer.js`; they do not add polygon control points.
