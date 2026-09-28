# MapMaker 3000

A browser-based world map editor for tabletop role-playing games. Place locations, move them around, zoom into detail maps, and keep notes on what happened there.

## Run locally

The site has no build step or package dependencies. Run the included development server:

```sh
npm run dev
```

Then open `http://127.0.0.1:8765/` in a browser on **the same computer**. `localhost` and `127.0.0.1` do not work as links for other people or devices.

## Current features

- Pan and zoom the map, drag existing places, and drag new places from the palette.
- Scroll over a continent to reveal provinces, then scroll into settlements, houses, and rooms. Each wheel gesture changes at most one level. Scroll out to reverse through those same levels. All maps stay local and switch without a page load.
- Double-click a place or use the atlas tree as another way to move between levels.
- Add descriptions and session notes to places.
- Automatically save in this browser and export/import an atlas as JSON.

The data format uses stable IDs for places and boards. Each place also has a `provenance` field, and the atlas reserves a `sessions` collection. These are the foundations for future reviewed suggestions from session recordings; no audio processing is included yet.

The starting atlas includes three example continents and detail maps down to rooms. Existing atlases are preserved; use **New atlas** if you want to replace one with the new example.

## GitHub Pages

The app is a static site. The files are already in the public GitHub repository. To give it a link that works in any browser, open the repository's **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/(root)**, then save. Once GitHub finishes publishing, use `https://colonelfrikandel.github.io/MapMaker3000/`.

Browser storage is local to one browser and device. Export your atlas regularly to keep a backup or move it to another device.

## Planned zoom improvement

Replace the current immediate map-level switch with continuous zoom ranges. Each range will blend progressively from the world to continent, province, settlement, and house interior, while preserving the cursor's position and allowing the same smooth motion in reverse. The existing board IDs and parent links can support this without changing the saved atlas format.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
