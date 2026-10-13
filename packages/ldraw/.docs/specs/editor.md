# Feature: editor

## Behaviour

The LDraw editor tools an app embeds in its own page, browser code only. Today the model viewer: `createModelViewer(element, { libraryUrl, look?, detail? })` puts a canvas with orbit controls and a stats readout in `element` and shows the LDraw text the caller passes. It reads no files: the caller fetches the model and serves the library at `libraryUrl`.

## User flows

- **Show a model**: `showModel(text)` parses it in the viewer's worker (nothing split out), draws it in the active look with the studio lights, LDraw's y-down axes turned up, and frames the camera on it; `{ isCameraKept: true }` keeps the view (the same model, edited). A later call wins: a model that finishes loading after it is dropped.
- **Change the look**: `setLook(preset)` makes it the page's active look and draws the shown model again in place.
- **Change the detail**: `setDetail(LDrawDetail.LOW | HIGH)` draws the shown model again with plain or logo studs.
- **Read the cost**: the readout and `getStats()` give the last frame's draw calls and triangles.
- **Remove it**: `dispose()` stops drawing, lets go of the model and takes the viewer out of `element`.
- **Describe a model**: `describeLDrawModel(text)` gives the part count of the main file and its opening comments.

## Invariants

- The viewer never fetches a model, lists files or knows a server's routes; the library URL comes in.
- The parser and the look are the page's: the first `setUpModelParser` settings stay (a game that set up its own parser keeps it), and a look set by the viewer is every drawing's.
- A shown model's prepared copy is released when it is replaced or the viewer is disposed.

## Out of scope

Picking files (the studio does), the builder and the minifigure poser (later), and anything a game adds to a model.
