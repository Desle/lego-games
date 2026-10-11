# Collision queries against BSP volumes

Source: `LEGORacers.exe` (English, 1999-07-22). The race does all collision against the world's BSP volumes (`.BVB`, parsed by `GolDP.dll` `0x1001b800`, see [bsp-volume.md](bsp-volume.md)) in the executable; it walks the DLL's BVB object directly. No DLL query function is involved. The port lives in `packages/lego-racers/src/modules/collision`; the car code that calls it is in [physics.md](physics.md).

## Collision objects

A car rigid body keeps up to five collision objects at `+0x140` (count `+0x154`; `0x00444d90` sets the first two, `0x004488e0` adds, `0x00448930` removes). Each is a world BVB instance (100 bytes, a Gol frame): `+0x28` rotation, `+0x4c` position, `+0x58` the BVB object, `+0x5c` an optional material list that replaces the BVB's own (`+0x18`). Before each query the caller points BVB object `+0x24` at one or the other. The first object (the track) is queried in world coordinates; the others are queried in their own frame (frame slots `+0x30`/`+0x38` in, `+0x2c`/`+0x34` out).

The BVB object fields the query reads: `+0x08` nodes (20 bytes), `+0x0c` the vector list (`+0x08` array of float triples), `+0x14` the keyword `0x2d` entries (8 bytes: three uint16 vertex indices and a uint16 material index), `+0x24` the material list (`+0x08` array of material pointers), `+0x2c` a node stack (12 bytes per entry; sized by `0x1001be50`). Node: `+0x00` the plane normal (float triple), `+0x0c` first entry, `+0x0e` entry count, `+0x10` child on the normal's side, `+0x12` the other child (both uint16; `0xfffe` and `0xffff` are no child). A node's plane passes through vertex 0 of its first entry.

**Mirrored races**: `Race_LoadRaceDescription` (`0x00431e00`) passes its mirror argument to `Race_LoadWorlds` (`0x00432e20`), which then runs `World_Mirror` (`0x00416140`) on every world: `BspVolumeInstance_Mirror` (`0x00403f80`) calls `BspVolume_Mirror` (`0x004045e0`: negate y of every node normal and vertex, swap entry fields `+2` and `+4`) and `0x00411040` (mirror the instance frame). Ported: `getMirroredCollisionVolume` and the frame mirror `0x00411040` (y of the forward axis, the up axis and the position negated, rotation rebuilt; `loadCollisionWorld`).

## `BspVolume_QuerySegment` (`0x00403fa0`, thiscall on the BVB object: start, end, triangle target, point target, material target, fraction target)

Ported as `getSegmentQueryResult`. A front-to-back walk with an explicit stack; each entry has a state:

- **0**: `d0` = normal · (start − plane vertex) (the differences stored, the dot `(n.z·d.z + n.y·d.y) + n.x·d.x` on the stack, `0x00404680`), kept as float32; descend into the child on the start's side (`+0x12` when `d0` ≤ 0).
- **1**: `d1` likewise for the end. If start and end lie on the same side (≤ 0 counts as behind), done with this node. Otherwise the segment crosses the plane at fraction `a / (a + b)` (`a` = |`d0`| stored, `b` = |`d1`| stored), the crossing point (start + fraction × (end − start), `0x004045b0`, `0x00404550`) is written to the point target, and the node's triangles are tested (`0x004497f0`) with the node's normal. For each triangle the point is in, `n = (v2 − v1) × (v0 − v1)` (`0x00404580`, `0x00404510`): when `n · (end − start)` ≤ 0 (it faces the start) it is the hit at once; otherwise it is remembered. After the loop the last remembered one is the hit. A hit stores the vertices, `normalize(n)` (`0x004492d0`) at `+0x24`, the plane distance `-(v0 · n)` at `+0x30`, the material and the fraction. Without a hit, descend into the far child.
- **2**: pop; an empty stack returns 0.

The point target is written at every crossing, so a miss can leave a point behind; the port returns it as `lastCrossingPoint` (wheel probes target the wheel's `+0x30`).

## `Math_IsPointInTriangle` (`0x004497f0`, cdecl: point, triangle record)

Ported as `getIsPointInTriangle`. Drops the axis along which |normal| is largest (when |x| > |y|: x if |z| ≤ |x|, else z; otherwise y if |z| ≤ |y|, else z) and runs three edge tests in the remaining plane, each edge's constant stored. The winding of the projected triangle (`(w1 − w2)(u1 − u0)` against `(u2 − u1)(w0 − w1)`) chooses ≤ or ≥; points on an edge are inside.

## `Wheel_CrossTriangle` (`0x00448b80`, cdecl: wheel, triangle record)

Ported as `getTriangleSegmentResult`. The wheel's probe (`+0x18` to `+0x24`) against a cached triangle's plane (`(n.z·p.z + n.y·p.y) + p.x·n.x + d`): when both ends are on the same side (below zero is one side), no crossing; otherwise the crossing point goes to the wheel's `+0x30` (x and y offsets stored, z not) and the result is `0x004497f0`.

## Real data

The English `LEGO.JAM` holds 45 `.BVB` files. In `GAMEDATA\RACEC0R0\COLLIDE.BVB` (the first race's track volume; materials `road`, `grass`, `carpet`, `wall`, `go_thru`, …) every flat triangle is found by a short vertical segment through its centre; floors are wound so that their cross product points up, so the query meets them front first from above. The checkpoint volumes (`CHCKPT*.BVB`) use digit material names, which the car body's contact filter (`0x0042a830`, not ported) hands to the checkpoint code.

## Not ported

`0x1001be50` (the stack depth), the frame mirror `0x00411040`, the BSP trees (`.BDB`, mirrored by `0x00403f20`).
