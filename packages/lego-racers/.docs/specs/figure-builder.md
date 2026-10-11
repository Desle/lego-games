# Feature: figure-builder

## Behaviour

The data side of the driver figure builder of the original (`0x0042dfa0` to `0x0049db90`): the part catalogue (`BODYPART.PCB`, `BodyPartCatalog_Load` 0x00498740), the packed part geometry (`ICB_CHAR.GCB`, `CBBODIES.GCB`, `BuilderGeometry_Load` 0x00407690) and the model of a driver made from them: the game's box body (`LEG_BOX.GDB`) with the head and hat of the catalogue on the face bone, and the face, torso and legs materials replaced by the driver's own parts, tinted 200, 200, 200.

## User flows

- Read the files: `parseBodyPartCatalog(bytes)`, `parsePartGeometry(bytes)`.
- Make a driver: `buildDriverModel({ catalog, geometry, body, partBytes })` gives positions, normals, texture coordinates and batches (material name, vertex indices, one bone per corner, tint).

## Invariants

- The catalogue lists the hats, heads, torsos and legs of the game (36, 30, 29 and 20 entries) and keeps every entry the file has.
- A part's vertices are raw 16-bit values, its model scale is 1/64 and a group names one material.
- The part byte order of a driver is hat, face, torso, legs, expression.

## Out of scope

The menu's figure with its expressions and animation of the face, the colour variants of the menu parts, and the exact bone of the hat (hypothesis: the face bone).
