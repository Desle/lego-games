# Feature: building

## Behaviour

The pure maths of building with LDraw parts on the stud grid, in LDraw units and axes (a stud is 20 wide, a plate 8 high, y points down): reading and writing model documents, quarter-turn rotations, the studs, box, footprint and bottom of a part read from the library, placing a part on studs or against a side stud, and editing a selection of parts with undo history.

## User flows

- **Read and write a model**: `parseBuilderDocument` splits a model file into header, reference lines, parts and kept lines; `serializeBuilderDocument` writes it back unchanged where it was not edited; `inlineReferencedModels` and `placeReferencedParts` resolve submodel references.
- **Read a part's shape**: `createPartShapes(readFile)` (or `createPartStudLists`) walks a part's files with a `LibraryFileReader`, such as `createCachedReader(createLibraryFileReader(libraryUrl))`, and gives its studs, box, footprint and bottom.
- **Place a part**: `getPlacementPosition`, `getGridPoint`, `getTopGridPoint` and `getSideStudPosition` snap a part to the grid of the part or ground under the cursor; `getFacingRotation` and `turnAbout` turn it in quarter turns.
- **Edit parts**: `moveParts`, `turnParts`, `tiltParts`, `addParts`, `removeParts`, `recolorParts` return new part lists; `pushBuilderHistory`, `undoBuilderHistory` and `redoBuilderHistory` keep the history.

## Invariants

- Every function is pure and returns new frozen data; nothing here touches three.js, the DOM or a game.
- Rotations stay exact quarter turns (`cleanRotation` removes floating-point drift).

## Out of scope

The builder page, its camera, keyboard shortcuts, panels and file storage, which belong to the app.
