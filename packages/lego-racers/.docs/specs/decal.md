# Feature: decal

## Behaviour

Projects a picture straight onto the triangles of the world, as the engine's decal object does (`LegoRacers.exe` `0x00414950`, `0x00414a30`, `0x00414c90`). The car shadows use it: each racer's shadow is a decal over the track's faces that take decals.

## User flows

- **Place a decal**: `createDecalFrame` turns a placement (centre, projection direction, up hint, size, reach) into the decal's axes (`0x00414c90`, `0x004492d0`).
- **Project a decal**: `projectDecal` takes the world (BSP tree, positions, the runs of faces by material) and the frame and returns the triangles with picture coordinates: the BSP leaves the box touches (`0x00403cc0`, five probe points of `0x00415a60`), the faces of receiving materials in those leaves, the mapping (`0x00414d50`), the out-codes (`0x00414e40`), the back-face test and the clipping to the picture (`0x00414f40`), at most 16 triangles (`0x00415810`, asked for by `0x0043d9cc`).

## Invariants

- Only materials with flag `0x20000` receive a decal.
- A face wholly outside one picture edge, or turned away from the decal, adds nothing.
- Float sums follow the engine's order and precision; a vertex made on a far edge carries 0.99 as the engine writes it.

## Out of scope

When and where the oil slick, scar and crane shadow (`0x004573a0`, `0x00421850`, `0x00490330`) are laid (their placements are `decal-placements`; the views are built by `race-presentation`), and the skid marks, which are particle emitters (vehicle `+0x1e4`, `0x004927c0`), not decals.
