# Particle emitters (`.EMB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/emitter`.

`Emitters_Load` (`0x00489af0`, race `+0x2150` and `+0x248c`, also `0x004a1240`; no mirror argument):

```
0x27 [ count ] {
(0x27 "name" { keywords }) * count   // 0x0048a130; names ≤ 8, registered with 0x00411870
}                                    // read only for a non-zero count
```

Emitter object `0x44` bytes, reset by `0x0048a0e0` (zeros, `+0x1c` = `+0x20` = 1.0, `+0x34` = -1).

| Keyword                  | Values                                | Offset                        | Port field                 |
| ------------------------ | ------------------------------------- | ----------------------------- | -------------------------- |
| `0x28`                   | float → `_ftol`                       | `+0x14`                       | `firstTruncatedValue`      |
| `0x29`                   | float → `_ftol`, low byte             | `+0x18`                       | `secondTruncatedValue`     |
| `0x2a`                   | 3 floats                              | `+0x08`..`+0x10`              | `vector`                   |
| `0x2b`                   | `[ n ] {` 3n floats `}`               | `+0x00` points, `+0x04` count | `points`                   |
| `0x2c`                   | float                                 | `+0x1c`                       | `firstFloat`               |
| `0x2d`                   | float                                 | `+0x20`                       | `secondFloat`              |
| `0x2e`                   | int → pointer `param +0xc + 0x18·n`   | `+0x38`                       | `entryIndex`               |
| `0x2f`                   | int                                   | `+0x30`                       | `firstInteger`             |
| `0x30`                   | int                                   | `+0x34`                       | `secondInteger`            |
| `0x31` / `0x32` / `0x33` | float                                 | `+0x24` / `+0x28` / `+0x2c`   | `thirdFloat`..`fifthFloat` |
| `0x34`                   | name ≤ 8, looked up with `0x00413200` | `+0x40`                       | `linkedName`               |
| `0x35`                   | int, low byte                         | `+0x19`                       | `thirdInteger`             |

Anything else is error 0. Every field name is neutral; their roles in the particle system are not recovered.

Verified: all 17 `.EMB` files parse to their last byte, except the two empty lists whose `}` the loader never reads.

## Drawing a system (`0x00412a50`)

`Emitters_Draw` (`0x0048a040`) draws the common pool and then the track's. A system draws when its flags `0x1` and `0x2` are set, it has particles, and the camera is within its squared radius (`+0x94`, the fifth float squared) of the system's frame. If it was drawn since the last update, `0x00412890` runs with 0 ms first (it gives every particle its row again). The camera's frame slots `0x30` and `0x34` (`0x10002f50`, `0x10002f70`) are its first two rows, right and down; the engine builds the camera from forward and up, so right is up x forward.

Particles are grouped by material (the pointer in particle `+0x30`, from the animation row or, for an emitter without an entry, the emitter's linked material at system `+0xd4`; a newborn particle has none until the next update) and drawn in list order. A quad (`0x00412ce0`) is centred on the particle: half of the right axis scaled by the first float and half of the down axis scaled by the second (a moving system, flag `0x4`, takes `third * age/lifetime + first` and `fourth * age/lifetime + second`, and draws nothing for a size not above zero), corners in the order centre minus half of each axis, along right, along down, back; pictures from 0.01 to 0.98; faces (2, 1, 0) and (3, 2, 0); vertex colour the material's colour (`+0xc`).

Verified with `render-trace` on `RACEC1R0`: the leaf quads (`dfleafy`, `dfleafy2`) match in place. A lookup by a material name takes the last library that defines it (`0x10028c20`): `dfleafy` exists twice.

## An emitter that follows an object (`0x0045ebe0`)

A track event of class 3D holds an emitter and, when it names an object, moves it every update: event `+0x34` is the skeleton instance and `+0x38` the bone (record keyword 0x54). The bone's origin is taken through the bone's transform and each parent's up to the root (the node's slot `+0x4`), scaled by the model's scale (1 here), and carried by the instance's frame (`+0x2c`); the result is the emitter's position (`0x00489660`). The wizard's emitter (`wizardtl` in `RACEC1R0`) follows bone 0 of the wizard, so its first particle is born where the wizard is, not at the event's own position. Port: `getBonePosition` (`skeletal-animation`), `TrackSession.getObjectBonePosition`, the 3D event's update; the world loader now reads the skeletons (`.SDB`) the instances name.

Verified with `render-trace` on `RACEC1R0`: the wizard's quads match in place, shape and colour (a material's opacity goes into the vertex alpha).

## No small-quad cut

An earlier reading of the race preview's snow took the missing small quads for a size cut. It was not: those quads lie above the 3D viewport (y below its top edge), and the engine rejects a triangle whose three vertices share an outside outcode. `FUN_1000e540` (a transform variant of GolDP) writes each vertex's outcode from the signs of its clip coordinates (bit value 4 is the negative y), `0x1000edf0` then drops such triangles before the facing test. A quad inside the viewport is drawn at any size (measured in the emulator: every quad of the 24 the particle draw `0x00412ce0` submits reaches the face test; the ones with outcode 4 are outside the viewport). The particle draw itself only drops a size that is not above `DAT_004af300` (0.0). Nothing to port: the viewer's viewport clips them.

## The vehicle's emitters (`0x0043e070`, `0x0043dc00`, `0x0043def0`, `0x0043df90`, `0x0043dd50`)

A vehicle gives each emitter it holds a basis (the display frame's rotation, frame slot `+0x44`), a position (`0x00489660`) and, while it runs, a velocity offset (`0x00489690`: the vector times 1000). At the start they get the basis and a position only: the dust and the tire smoke at the rear right wheel's anchor (car body `+0x2f4`), the boost smoke at the middle of the two rear anchors (`+0x284`, `+0x2f4`) 2 higher, a wheel's surface emitter at that wheel's anchor (`+0x1a4 + 0x70·n`), the landing's `carland` at the display frame's position. Every update the wheel emitters follow their wheels first; then (after the landing) the dust is let go after 9 births, else it draws a random value and moves to the rear right wheel when the low byte's second bit is set, else the rear left; the boost smoke follows the middle of the rear wheels and is let go after 3 births; the tire smoke draws and takes the first wheel that asks for marks (skid flag bit 0x1) when the bit is set, else the last one after the first (the origin when there is none). The velocity offset is 0.6 of the car body's velocity (`+0x8`, `0x004b0b08`).

The render trace has no sound device, so the original draws no racing tune: the harness loads the race with `musicTuneCount: 0` (the golden trace does the same), which keeps the random cursor, and so every birth, in step.

Verified with `render-trace` (`Royal Knights, power slide`): the player's dust and tire smoke particles equal the original's, and so do the surface emitters' (`graspart`). The golden trace has the same scenario (`royal-knights-power-slide`) and no field differs.
