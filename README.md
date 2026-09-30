# MapMaker 3000

A browser-based world map editor for tabletop role-playing games. Place locations, move them around, zoom into detail maps, and keep notes on what happened there.

## Run locally

The site has no build step or dependency installation. Polygon clipping is vendored locally with its license in `src/vendor`. Run the included development server:

```sh
npm run dev
```

Then open `http://127.0.0.1:8765/` in a browser on **the same computer**. `localhost` and `127.0.0.1` do not work as links for other people or devices.

## Current features

- **Azgaar terrain baseline:** **Generate world** now defaults to Azgaar terrain with its 14 original procedural landscape templates, including Continents, Pangea, High Island, and Archipelago. Choose a template, use **Randomize**, inspect the preview, then apply. **Include mountains, rivers and lakes** uses the saved Azgaar heightmap with MapMaker's drainage and rendering; uncheck it for coastlines only. Forests, deserts, and other biomes remain unassigned, and no new settlements are generated. Existing campaign locations and manual biomes are preserved. **MapMaker sliders** remains available in the generator selector.
- Azgaar's MIT-licensed grid and heightmap algorithms are vendored locally with pinned dependencies and license notices in [src/vendor/azgaar](src/vendor/azgaar/README.md). This integrates its terrain recipes, not the full Azgaar application, political simulation, or visual theme. The source heightmap is saved with the atlas and survives export/import. No runtime downloads or API keys are needed.

- **Layered forest artwork:** manually placed forests use the two tree PNGs in `assets/trees/realm-trees`. Back-edge trees render first, then a solid matching green fill, sparse interior treetop marks, and foreground trees along lower edges. Holes reverse the edge treatment; vertical edges stay clear. **Edit biomes → Tree edge angle** adjusts the default 60° cutoff from horizontal, with undo and export support. Adjacent visible forest areas merge for artwork so shared edges do not get tree seams. Saved biome handles are unchanged.

- **Landmass sliders:** open **Generate world** to adjust Land coverage, Fragmentation, Elongation, Coast complexity, and Island amount, plus horizontal/vertical orientation. The preview updates after a short pause and stays visible while scrolling through controls. **Randomize** changes the seed while keeping your settings. Advanced settings contain the seed, dimensions, and center. Low fragmentation starts with one substantial mainland; higher values cut straits between landmasses. Coverage is a relative control, not an exact land percentage. Generation still produces plain land only. Apply is one undoable action; Cancel leaves the atlas untouched. Existing coastlines remain unchanged until a preview is applied.

- **Reviewed session text:** select a place and choose **Review session text**. Paste a relevant passage, find suggestions, and explicitly select notes, a campaign event, or a suggested biome circle. Nothing is preselected. Biome changes show before/after maps; applying is one undoable action and preserves the original passage and session reference. This first version uses conservative English keyword matching, not AI interpretation: it does not resolve relationships, create villages or bridges, or transcribe audio. Mixed or negated biome mentions are skipped.

- **Biome-aware settlement artwork:** town and village maps adapt ground, roofs, roads, water and vegetation to the biome under their center. Forest uses timber tones and fuller trees; desert uses pale courtyard-like roofs and sparse scrub; snow uses pale roofs and conifers; swamp uses reeds and muted wetland colors. Grassland, tundra and alpine styles are included. Ground edges fade into the map while roads and buildings stay visible. Moving a settlement or editing its biome updates its appearance without moving buildings, replacing notes, or regenerating layouts. Unassigned land and legacy worlds retain the existing style.

- **Place environment:** select a place on an independent world to see its biome, nearby water and roads, and potential resources. Sampling follows nested map positions and updates after moves or biome edits. Plain land remains unassigned; elevation and climate are unknown unless existing saved fields provide them. Settlement artwork uses this live context without regenerating saved geometry.

- **Political borders:** on an independent world, choose **Edit borders**, select a realm and draw its territory. The shared polygon tools support vertex editing, whole-region movement, duplication, deletion and reassignment. Borders are a separate translucent layer with dashed outlines, controlled by the **Borders** checkbox. Editing a border never moves settlements or changes terrain, biomes or climate. Territory priority controls overlap display; it does not reassign settlement ownership. Deleting a realm removes its territory polygons in the same undoable action; reassign or delete its territories before changing the realm's type.

- **Biome editor:** generate a clean landmass, then choose **Edit biomes** and drag Forest, Grassland, Swamp or another preset onto the map. Each drop creates a smooth circular area with exactly four editable points. Drag a point to reshape it; double-click its boundary to add another point at that location. Drag inside to move the whole area. Deletion, duplication, biome changes and priority changes are undoable. Rounded areas retain their sparse control points through save/load; overlap clipping happens in the display geometry. Alt-drag pans and scrolling zooms.

- **Independent continents:** use the landmass sliders and inspect the coastline and realm-center markers before applying. Conversion preserves campaign locations and warns about realm centers falling in water. Cancel leaves everything unchanged; Undo restores the old world. Older preset-based atlases still load with their saved geography.
- Once converted, adding, moving, renaming or deleting realms cannot alter the landmass. Realm biome/island controls are hidden for converted worlds. Existing atlases and the starting example retain the realm-based generator until explicitly converted.
- **Campaign discoveries first:** the base world can contain coastlines, mountains, rivers and lakes. Forests, deserts, villages, and other campaign discoveries are added manually or through reviewed session suggestions. Turning off physical geography creates plain land and clears old automatic geography while retaining manual/protected content. Existing maps stay unchanged until you apply a preview. Audio transcription belongs in an external app; MapMaker accepts pasted session text.

- Undo/Redo restores editing actions, deletion, generation, imports and format upgrades during the current session. Use the toolbar or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (Ctrl+Y also works). Text fields retain native text undo; consecutive typing in one field is grouped into one atlas action. History holds up to 40 actions within a bounded snapshot budget and resets on reload.
- Generation previews use isolated candidates: Cancel or Escape discards them, Apply commits the preview as one undoable action, and stale previews are rejected. In towns and villages, a separate vegetation seed changes trees without changing the layout seed, roads or buildings. Newly generated settlement scenery uses updated generator versions; existing saved scenery stays unchanged until regeneration is applied.

- Pan and zoom smoothly through world, continent, province, settlement, and interior detail. The same detail level is available everywhere, so panning sideways reveals neighboring places and their details.
- The world map forms one continuous mainland from neighboring realms. Select a realm to choose its landscape, or mark it as a separate island. Coastlines stay closed and terrain colors and symbols blend between neighboring realms. **Generate world** previews another seeded coastline without moving or renaming realms.
- World coastlines come from a connected terrain field with variation at several scales, producing irregular peninsulas, gulfs, coastal detail, and inland water. An island placed inside the mainland sits in a lake with a water border following its coastline. At the coast, that water joins the sea. Two islands still cannot overlap or touch; conflicting changes show a message instead of moving your realms. Renaming a realm preserves its geography. Older saved atlases still load, including inland islands.
- The world expands with your realms in every direction, including negative coordinates. Zoom out and place or drag realms beyond the old map area; **Reset view** fits the expanded landmass. There is no fixed coastline boundary or edge squeeze. Town and interior maps retain their existing local dimensions.
- Places outside the view are removed from the page and rendered again when you approach them. Scroll out to reverse through the same continuous ranges without a page load.
- The map uses deterministic vector artwork instead of location cards: coastlines and terrain, plus generated town districts, streets, walls, squares, fields, trees, and building shapes. Map layers are rendered only when in view.
- Drag existing places and drag new places from the palette. Double-click a place or use the atlas tree to fly to it.
- Connect two places on the same map with a road, trail, river, sea route, or passage. Click the connection to name it and add travel notes. Connections follow their places when those places move.
- Every new town and village gets an original generated map automatically. Villages support river crossings, crossroads markets, and coastal harbors, with seeded roads, buildable roadside plots, fields, and woodland. **Regenerate surroundings** previews new scenery while preserving named building footprints, interiors, events, and established roads and water.
- Double-click an ordinary building to mark it as a notable house, or choose **Notable house** from the palette and click a footprint. Name it, explore inside, and add rooms. Place cards also support keyboard selection with Space and opening a selected place with Enter.
- Pin campaign events to places and rooms, including a session label and description. An event-count badge marks places with history; events are saved and exported with the atlas.
- Add descriptions and session notes to places.
- Automatically save in this browser and export/import an atlas as JSON.

The data format uses stable IDs for places, boards, and connections. Places and connections have a `provenance` field, and the atlas reserves a `sessions` collection. These are the foundations for future reviewed suggestions from session recordings; no audio processing is included yet. Existing saved atlases without connections load unchanged.

The starting atlas uses State Of Kemeia, Idrieland, Emerald Bay, and Island Of Crieta as test realms. The first three share a mainland; Crieta is a separate island. The supplied JSON files are reference material for later generation work; the site generates its world geometry itself. Existing atlases are preserved; use **New atlas** if you want to replace one with the new example.

Open the [four-realm example](https://colonelfrikandel.github.io/MapMaker3000/?example=four-realms) to try it with separate browser storage, leaving your normal atlas untouched.

To try another settlement layout, open a town or village and click **Regenerate surroundings**. Choose a seed and size, inspect the preview, then choose **Use these surroundings**. The same seed, size, and preserved places and geography reproduce the same geometry. Double-click a building to name it and explore its interior.

## Try the campaign village

Choose **Explore Brackenford** in the sidebar. This adds an example to your existing atlas (and reopens it on subsequent clicks). The Bracken Valley contains the village; its river and approach road connect visually to the settlement. The Broken Oar tavern stands beside the crossing and has a common room, kitchen, guest room, and cellar. Use the breadcrumbs to visit the countryside, or zoom into the tavern.

Select the tavern and choose **Pin an event here** to record a discovery. Then use **Regenerate surroundings**, change the seed or size, inspect the preview, and choose **Use these surroundings**. The tavern's footprint, identity, position, rooms, notes, and events remain intact. The same seed, size, and established geography produce the same preview. Unnamed scenery may change.

In the village generator, uncheck **Keep established geography** to choose **River village**, **Crossroads village**, or **Coastal village** and regenerate the road layout with the seed. Leave it checked to change only surrounding buildings, fields, and trees. In a village place inspector, **Keep this place when regenerating** protects its position and building footprint (on by default for existing places). Unchecked houses can move to new plots; their names, interiors, notes, and events remain attached. Conflicting geography is rejected in the preview without changing the atlas. Protection choices are saved and exported.

Town generation retains its older layout, and interiors use simple room diagrams. AI transcript interpretation, player/DM visibility, and multiplayer are not implemented; pasted session text supports the reviewed keyword workflow above. Example descriptions are sample content, not established campaign facts.

## Tests

Run `npm test`. Tests check JavaScript syntax for the browser entry point and runtime modules, and cover deterministic generation, connected roads, plot spacing, river and coast clearance, all three village types, kept and movable places, conflict handling, nested layout, preservation during regeneration, and campaign data JSON round trips.

## GitHub Pages

The app is published at [https://colonelfrikandel.github.io/MapMaker3000/](https://colonelfrikandel.github.io/MapMaker3000/). GitHub Pages deploys from the `main` branch root.

Browser storage is local to one browser and device. Export your atlas regularly to keep a backup or move it to another device.

## Map coordinates

World terrain uses at most 140,000 grid samples per generation and at most 1,600 decorative symbol attempts. Very large or widely spread worlds use coarser coastlines instead of allocating an ever-growing grid. The world SVG and its lake mask are displayed through a viewport-sized surface; panning and zooming reuse existing geometry. Wide views scan existing places rather than millions of empty spatial cells, and long routes bypass oversized cell indexes. This supports large coordinates, not an unlimited number of realms at unlimited detail. Continent shapes are procedural approximations rather than a simulation of plate tectonics or erosion.

Run `npm run benchmark:world` for reproducible geometry/SVG timings with 4, 100, and 500 realms. The benchmark reports generation work and SVG size; it does not measure browser frame rate. Geography changes with this generator version, while saved realm positions, names, notes, and detail maps remain intact.

Each board retains its existing local place coordinates. At render time, its geometry is projected inside its parent place into shared world coordinates. Zoom controls one camera across every board; adjacent places at the same depth therefore stay adjacent. The renderer mounts only nearby map features and terrain, and blends neighboring detail depths as the scale changes. New atlases use schema version 2. Existing version 1 atlases remain version 1 until you choose **Upgrade atlas format**, review the summary, and apply it. The upgrade preserves geography and campaign content; it does not generate a new continent. Version 2 exports require this version of the app or newer. See [the atlas format](ATLAS_FORMAT.md) for the layer model and migration contract.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
