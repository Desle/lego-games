# Decals: the car shadow

A decal is a small dynamic mesh that the engine builds each frame from the world's triangles that lie inside an oriented box, with picture coordinates in the box. Module: `decal` (`packages/lego-racers/src/modules/decal`); the viewer draws the result in `race-decals.ts`.

## The vehicle's shadow (`0x0043fa50`)

Called each frame per vehicle. It returns at once when vehicle flag `0x10` is set (the warp has taken the car off the track) or flag `0x4` is clear. Otherwise it takes the squared distance from the camera to the part's centre and returns when it is not below the figure's `+0x84` (250000 normally; `-1` from the warp's start `0x0043dbb0` until the landing `0x0043db60`, so the shadow is off meanwhile).

It then fills the placement:

| Field         | Value                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| position      | the figure's centre, z + 6 (`0x004b0af4`)                                                    |
| normal        | figure `+0x58` side: (0, 0, -1), straight down                                               |
| up hint       | minus the display frame's second row                                                         |
| width, height | hull extents `+0x198`, `+0x19c` (times the figure scale `+0x58` when not zero; 1 for racers) |
| reach         | 15 (`0x004b0af0`)                                                                            |
| picture       | image named at vehicle `+0x218` (`carshad0..5`)                                              |

`0x00414c90` builds the axes (`0x004492d0` normalises); `0x00414a30` projects.

## Projection

1. `0x00415a60` makes five points: the position, then the four lower and upper corners of the box along the right vector. `0x00403cc0` walks the world's BSP tree with them: the leaf of the first point first, then the far side of each plane on the way back up where another point lies beyond it.
2. For every command run inside those leaves whose material has flag `0x20000` (material keyword `0x4a`), each face is mapped (`0x00414d50`: u along the right vector, v along up, 0.99 over the size, 0.5 at the centre) and given an out-code (`0x00414e40`: bit 1 u < 0, 2 u > 1, 4 v < 0, 8 v > 1, computed from the float bits).
3. `0x00414f40`: a common out-code bit drops the face; a face turned clockwise in the picture is dropped; a face with no out-code is kept; the rest is clipped against u = 0, u = 1, v = 0, v = 1 in that order and fanned.
4. `0x00415810` stops at the capacity asked for by `0x0043d9cc`: 16 triangles.

## Verification

`pnpm run render-trace`: in the Royal Knights case no `carshad` triangle is missing or extra in the five recorded frames. In `RACEC0R2` the shadows match in position, but at one recorded frame the original draws `carshad1` with diffuse alpha 80 against the material's 180; the source of that fade is not found yet.

## Not decals

The skid marks are not ribbons projected on the track: vehicle `+0x1e4..+0x1f0` are four particle emitters, one per wheel, made by `0x004927c0` with kind `0x3e8` (`0xfa` when vehicle flag `0x100` is set) and freed by `0x00492820` (`0x0043f424`, `0x0043dce3`). They draw with the `skid` material and belong to the particle work. The oil slick and scorch marks use the decal object (callers `0x004573a0`, `0x00421850`, `0x00491e20`, `0x00490330`) and are not ported yet.
