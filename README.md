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
- Places outside the view are removed from the page and rendered again when you approach them. Scroll out to reverse through the same continuous ranges without a page load.
- The map uses deterministic vector artwork instead of location cards: coastlines and terrain, settlement footprints, streets and buildings, house roofs, and furnished room plans. Town and house map layers are rendered only when in view.
- Drag existing places and drag new places from the palette. Double-click a place or use the atlas tree to fly to it.
- Connect two places on the same map with a road, trail, river, sea route, or passage. Click the connection to name it and add travel notes. Connections follow their places when those places move.
- Preview and generate seeded town or village layouts with houses, a landmark, streets, and room layouts inside new houses. New seeds place buildings in available space; the streets follow editable places. Generate additional rooms and passages inside a house. Generation preserves existing places and notes.
- Import a Medieval Fantasy City Generator JSON export as a town or village base. Its coast, water, river, districts, walls, streets, fields, and building footprints become a compact vector layer. Choose **Notable house**, then click a footprint to add a named place and notes; ordinary footprints stay part of the map instead of becoming hundreds of empty interiors.
- Add descriptions and session notes to places.
- Automatically save in this browser and export/import an atlas as JSON.

The data format uses stable IDs for places, boards, and connections. Places and connections have a `provenance` field, and the atlas reserves a `sessions` collection. These are the foundations for future reviewed suggestions from session recordings; no audio processing is included yet. Existing saved atlases without connections load unchanged.

The starting atlas includes three example continents and detail maps down to rooms. Existing atlases are preserved; use **New atlas** if you want to replace one with the new example.

To generate a layout, zoom into a town, village, or house and click **Generate details**. Choose a seed and size, inspect the visual preview, or choose **New seed** to try another layout. A seed produces the same layout for the same starting map. Generated places are ordinary editable places; each keeps its generator seed in `provenance` for future session and revision tools.

To import a town base, open a town or village and click **Import town base**. Pick the JSON exported by Watabou's Medieval Fantasy City Generator. The file is transformed into the board's coordinates and saved with the atlas; it will also be included in a MapMaker JSON backup. The town base does not contain house interiors. Importing a base leaves existing named places and notes in place. The import button is separate from the top-bar **Import**, which restores a full MapMaker atlas backup.

## GitHub Pages

The app is published at [https://colonelfrikandel.github.io/MapMaker3000/](https://colonelfrikandel.github.io/MapMaker3000/). GitHub Pages deploys from the `main` branch root.

Browser storage is local to one browser and device. Export your atlas regularly to keep a backup or move it to another device.

## Map coordinates

Each board retains its existing local place coordinates. At render time, its geometry is projected inside its parent place into shared world coordinates. Zoom controls one camera across every board; adjacent places at the same depth therefore stay adjacent. The renderer mounts only nearby map features and terrain, and blends neighboring detail depths as the scale changes. The saved atlas schema remains version 1, including its future session provenance fields.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
