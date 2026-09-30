# Azgaar terrain integration assessment

Inspected 2026-09-30 at upstream commit `7940ee81c675befe784f047f92f212aaa031e38b`.
The initial terrain integration is now implemented locally. The template generator,
grid/Voronoi subset, and pinned dependencies are vendored with notices. All 14
recipes are selectable alongside the retained MapMaker slider backend. Source
heights survive export/import and feed physical geography without automatic
biomes. Browser visual verification remains pending; automated tests cover
generation, preservation, height consistency, previews, undo, and serialization.

## Campaign direction from “Idees for next steps”

The map is a record of discoveries, not a prefilled ecosystem. Base generation
provides physical geography only; forests, deserts, settlements, and campaign
facts are added as the group discovers them. Future session reconstruction
will operate in a selected area or travel corridor, present proposals with
source passages, and require accept/edit/reject. Audio transcription stays in
an external app. Pasted Dutch/English text, optional speaker labels, and
timestamps are the future input; no microphone or speech service is required.

The remaining implementation sequence below is a roadmap, not a claim that
terrain brushes, transcript interpretation, or full Azgaar imports are ready.

## Recommendation

Keep MapMaker's five sliders, Randomize, preview/apply/cancel, undo, editable
layers, and campaign identities. Add a versioned terrain backend adapted from
Azgaar's heightmap operations. Retain the current shape backend for existing
settings and comparisons until the new backend passes visual and preservation
checks. Do not embed the entire Azgaar application into MapMaker.

Azgaar generates height on a cell graph using composable hills, pits, ridges,
troughs, straits, masks, and smoothing. Its templates are ordered recipes for
these operations, including Pangea, Continents, Archipelago, and Peninsula.
This is a better candidate for varied terrain than continuing to add detail to
our radial outline and sliced mainland alone; the actual quality of a port
must be evaluated, not assumed to match upstream screenshots.

## Concrete integration boundary

- Keep `src/continent-controls.js` as the UI control registry.
- Add an isolated terrain module accepting seed, dimensions, settings, and a
  local random source. It must not mutate `Math.random`, atlas state, or DOM.
- Upstream uses a jittered point grid and Voronoi neighbors. Preserve that
  graph behavior for the first reference prototype, with pinned dependencies
  and notices; benchmark resampling to MapMaker's bounded regular grid.
- Produce a height field plus sea level, then convert height minus sea level
  into the signed field consumed by `contourField` in `src/landmass.js`.
- Extend the dispatch in `src/continent.js` with a new backend version, and
  update `src/atlas.js` validation and generation provenance together.
- Keep `src/world-planning.js` as the preview/merge transaction boundary.
- Retain the source height field for later natural geography. Currently
  `src/natural-geography.js` invents elevation after receiving a coastline;
  it will need an explicit path to consume the new heights instead, so rivers
  and mountains relate to the same terrain that produced the coast.

## Proposed slider mapping

| Control | Heightmap behavior |
| --- | --- |
| Land coverage | Adjust sea level toward a bounded target land fraction |
| Fragmentation | Adjust broad troughs and straits, with connected-mainland checks at low values |
| Elongation and orientation | Change the placement envelope for the main hills and ridges |
| Coast complexity | Adjust smaller coastal hills and depressions plus smoothing |
| Island amount | Add separate offshore hill clusters without rerolling the mainland stream |

These are proposed mappings, not existing upstream slider APIs. Calibrate them
across several fixed seeds so changing a control is predictable. A later
Landscape recipe selector can expose Mainland, Several continents, Archipelago,
and Peninsula without expanding the initial five-slider interface.

## Implementation order and acceptance checks

1. Pin the upstream revision and preserve copyright/license notices for reused
   code and templates. Audit the dependencies actually included in the port.
2. Port the graph/heightmap minimum into an isolated prototype. Replace global
   settings, global grid access, and random-number replacement with arguments.
3. Run mainland and archipelago recipes; compare their coastlines against the
   current backend across a fixed seed gallery before selecting a default.
4. Connect sliders and existing isolated previews. Verify Randomize retains
   settings, stale previews cannot apply, Cancel changes nothing, and Apply
   creates one undo entry.
5. Test determinism, slider extremes, connectivity, contour validity, large and
   negative coordinates, generation time, memory bounds, save/load, and
   protected/manual content. Verify old generator versions still load.
6. Persist the source elevation with a versioned contract before connecting
   mountains, rivers, rainfall, and settlement environment sampling.

Alternative: importing Azgaar's Full JSON export could let users bring an
already-generated world into MapMaker. That is a separate importer project:
cell geometry, coordinates, land/water features, rivers, settlements, and IDs
need conversion and a reviewed preview. It would not by itself improve our
Randomize workflow.

## Inspected upstream sources

- [Heightmap generator](https://github.com/Azgaar/Fantasy-Map-Generator/blob/7940ee81c675befe784f047f92f212aaa031e38b/src/generators/heightmap-generator.ts)
- [Heightmap recipes](https://github.com/Azgaar/Fantasy-Map-Generator/blob/7940ee81c675befe784f047f92f212aaa031e38b/src/data/heightmap-templates.ts)
- [Grid generator](https://github.com/Azgaar/Fantasy-Map-Generator/blob/7940ee81c675befe784f047f92f212aaa031e38b/src/generators/grid-generator.ts)
- [JSON exports](https://github.com/Azgaar/Fantasy-Map-Generator/blob/7940ee81c675befe784f047f92f212aaa031e38b/src/services/io/export-json.ts)
- [License](https://github.com/Azgaar/Fantasy-Map-Generator/blob/7940ee81c675befe784f047f92f212aaa031e38b/LICENSE): MIT, requiring preservation of its copyright and permission notice when reusing code.
