# Feature: studio

## Behaviour

The LDraw editor's development page: a tab list (Models for now) over the library's embeddable editor. The Models tab lists every model file of the local models folder, shows the chosen one in the model viewer with the model files it places, and reloads it when it changes on disk.

## User flows

- **Pick a model**: the picker lists `files.json` grouped by folder (the models folder's own files first, then each subfolder by name); choosing one shows it framed and puts its path in the address (`#<path>`), which selects it again on a reload. Without a hash the first file shows.
- **See a whole car**: a model that places other `.ldr` or `.mpd` files it does not hold (a car its chassis recipe `rrchas0.ldr`) gets each, found by name in any folder of the models folder, at any depth, added as a `0 FILE` section; a name with no file there is left to the library.
- **Change the look or detail**: the look picker offers every look preset (the address's `?look=` first), the detail picker logo or plain studs; the model is drawn again in place.
- **Edit elsewhere**: the list is read every 1.5 s; a new file shows in the picker, and the shown file is drawn again, the camera kept, when it changes on disk.
- **Read the model**: the status shows the part count of the main file and its header comments, or why it could not be read or drawn; the viewer's readout shows the draw calls and triangles.

## Invariants

- The page only reads: it never writes the models folder.
- The routes the page fetches are the ones the dev server mounts (`getLDrawFileRoutePaths(STUDIO_ROUTE_PREFIX)`).
- No game code: nothing of a game's index, folders or originals.

## Out of scope

The Build and Minifig tabs (later), saving, and anything a game adds (its originals beside a model).
