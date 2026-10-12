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
