# Feature: building

## Behaviour

The pure maths of building with LDraw parts on the stud grid, in LDraw units and axes (a stud is 20 wide, a plate 8 high, y points down): reading and writing model documents, quarter-turn rotations, the studs, box, footprint and bottom of a part read from the library, placing a part on studs or against a side stud, and editing a selection of parts with undo history.

## User flows

- **Read and write a model**: `parseBuilderDocument` splits a model file into header, reference lines, parts and kept lines; `serializeBuilderDocument` writes it back unchanged where it was not edited; `inlineReferencedModels` and `placeReferencedParts` resolve submodel references.
- **Read library files**: `createLibraryFileReader(readText)` is the one reader of library files: it turns a part line's name into `parts/<name>` or `p/<name>` in lower case, asks `readText` for it (the app's served library: `createServedLibraryReader(libraryUrl)`; a folder on disk in a spec) and reads each file once.
- **Read a part's shape**: `createPartShapes(readFile)` (or `createPartStudLists`) walks a part's files with that reader and gives its studs, box, footprint and bottom; `findModelFacePoints(text, readFile)` gives the corners of every face a whole model draws, without building it.
- **Place a part**: `getPlacementPosition`, `getGridPoint`, `getTopGridPoint` and `getSideStudPosition` snap a part to the grid of the part or ground under the cursor; `getFacingRotation` and `turnAbout` turn it in quarter turns.
- **Join parts**: `getPartConnections(partName, shape)` lists a part's connections in its frame (studs, the stud cells of its bottom, a hat's socket, and the minifigure joints of `getMinifigConnections` by part number or title); `findConnectionSnap(moving, standing, options)` finds the free, matching connection nearest on the screen (or, for a minifigure joint, nearest the cursor) and `applyConnectionSnap` moves (and for one part, turns) the parts onto it.
- **Drag helpers**: `getDominantAxis`, `lockToAxis` and `getIsAlongAxis` hold a drag to one ground axis; `getPlateOffset`, `getRayHeight` and `getIsVertical` move it up and down by plates.
- **Edit parts**: `moveParts`, `turnParts`, `tiltParts`, `addParts`, `removeParts`, `recolorParts` return new part lists; `pushBuilderHistory`, `undoBuilderHistory` and `redoBuilderHistory` keep the history.

## Invariants

- `STUD_WIDTH` (20) and `PLATE_HEIGHT` (8) are the one place the LDraw units are written; apps convert with them.
- Every function is pure and returns new frozen data; nothing here touches three.js, the DOM or a game.
- Rotations stay exact quarter turns (`cleanRotation` removes floating-point drift); only a minifigure joint turns a part off them, to the joint's own frame.
- A connection that already holds its mate (a covered stud, a filled neck) takes nothing; both legs share the hip axle. A stud cell resting on the ground takes no stud.

## Out of scope

The builder page, its camera, keyboard shortcuts, panels and file storage, which belong to the app.
