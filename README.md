# MapMaker 3000

A browser-based world map editor for tabletop role-playing games. Place locations, move them around, zoom into detail maps, and keep notes on what happened there.

## Run locally

The site has no build step or package dependencies. Run the included development server:

```sh
npm run dev
```

Then open `http://127.0.0.1:8765/` in a browser on **the same computer**. `localhost` and `127.0.0.1` do not work as links for other people or devices.

## Current features

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

Town generation retains its older layout, and interiors use simple room diagrams. Transcript extraction, reviewed AI suggestions, player/DM visibility, and multiplayer are not implemented. Example descriptions are sample content, not established campaign facts.

## Tests

Run `npm test`. Tests check JavaScript syntax for the browser entry point and runtime modules, and cover deterministic generation, connected roads, plot spacing, river and coast clearance, all three village types, kept and movable places, conflict handling, nested layout, preservation during regeneration, and campaign data JSON round trips.

## GitHub Pages

The app is published at [https://colonelfrikandel.github.io/MapMaker3000/](https://colonelfrikandel.github.io/MapMaker3000/). GitHub Pages deploys from the `main` branch root.

Browser storage is local to one browser and device. Export your atlas regularly to keep a backup or move it to another device.

## Map coordinates

World terrain uses at most 140,000 grid samples per generation and at most 1,600 decorative symbol attempts. Very large or widely spread worlds use coarser coastlines instead of allocating an ever-growing grid. The world SVG and its lake mask are displayed through a viewport-sized surface; panning and zooming reuse existing geometry. Wide views scan existing places rather than millions of empty spatial cells, and long routes bypass oversized cell indexes. This supports large coordinates, not an unlimited number of realms at unlimited detail. Continent shapes are procedural approximations rather than a simulation of plate tectonics or erosion.

Run `npm run benchmark:world` for reproducible geometry/SVG timings with 4, 100, and 500 realms. The benchmark reports generation work and SVG size; it does not measure browser frame rate. Geography changes with this generator version, while saved realm positions, names, notes, and detail maps remain intact.

Each board retains its existing local place coordinates. At render time, its geometry is projected inside its parent place into shared world coordinates. Zoom controls one camera across every board; adjacent places at the same depth therefore stay adjacent. The renderer mounts only nearby map features and terrain, and blends neighboring detail depths as the scale changes. The saved atlas schema remains version 1, including its future session provenance fields.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
