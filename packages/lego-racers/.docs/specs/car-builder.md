# Feature: car-builder

## Behaviour

The data side of the build-a-car menu, as the original's builder does it (`0x0049xxxx`): the brick database (`LPieceLo.leb`), the brick colours (`L_Colors.leb`), the car sets of the menu (`xx_cset.leb`, `CRSTMGR.LEB`), the racer saves (`default.lrs`, `qbuild.lrs`, parsed by `save-data`), the placement rules of the 10 by 6 build grid, the loading of a design with those rules, and the weight and centre of a design that the race takes as its mass and centre of mass. The menu's screens are somebody else's: this module exposes the rules as pure functions.

## User flows

- Read the files: `parseBrickDatabase`, `parseBrickColors`, `parseCarSetFileNames`, `parseCarSet`; or `loadSavedCars(readFile, path)` for a save with every design loaded.
- Ask whether a brick may go somewhere: `getPlacement(grid, footprint, x, y, orientation, isAutoHeight)` (the height it rests at, or not placeable); put it there: `getGridWithBrick`.
- Load a design: `loadCarDesign(bytes, database)` places the bricks of a save in order and drops any the rules refuse.
- Draw it: `buildCarGeometry(database, design, colorMaterialIndices)` gives the triangles by material.
- Weigh it: `getCarWeight(arithmetic, design)` gives the weight (unit cells of the builder's own bricks) and the centre offsets the racer slot carries.

## Invariants

- A brick rests on the highest attachable top under one of its connectors, or on the floor (bottom 0, auto height); a brick that collides, leaves the grid or would make the car taller than 15 brick units is not placed. A design holds at most 64 bricks.
- Only bricks with an id from 0x800 weigh anything; the chassis parts do not.
- Every design of the game's own saves loads completely.

## Out of scope

The coplanar-face clipping and vertex-cache passes of the mesh builder, the figure builder, the menu screens, saving a design.
