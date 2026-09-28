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
- Drag existing places and drag new places from the palette. Double-click a place or use the atlas tree to fly to it.
- Add descriptions and session notes to places.
- Automatically save in this browser and export/import an atlas as JSON.

The data format uses stable IDs for places and boards. Each place also has a `provenance` field, and the atlas reserves a `sessions` collection. These are the foundations for future reviewed suggestions from session recordings; no audio processing is included yet.

The starting atlas includes three example continents and detail maps down to rooms. Existing atlases are preserved; use **New atlas** if you want to replace one with the new example.

## GitHub Pages

The app is published at [https://colonelfrikandel.github.io/MapMaker3000/](https://colonelfrikandel.github.io/MapMaker3000/). GitHub Pages deploys from the `main` branch root.

Browser storage is local to one browser and device. Export your atlas regularly to keep a backup or move it to another device.

## Map coordinates

Each board retains its existing local place coordinates. At render time, its geometry is projected inside its parent place into shared world coordinates. Zoom controls one camera across every board; adjacent places at the same depth therefore stay adjacent. The renderer mounts only cards near the viewport and blends neighboring detail depths as the scale changes. The saved atlas schema remains version 1, including its future session provenance fields.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
