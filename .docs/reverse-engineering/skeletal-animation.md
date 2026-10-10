# Skeleton instances and animation sampling

Source: `GolDP.dll`. Port: `packages/lego-racers/src/modules/skeletal-animation`; the files are in `skeleton.md` and `animation.md`, the instance linking in `scene.md`.

## Objects

- **Frame / bone** (`0x10002890`, vtable `0x1005622c`, `0xd0` bytes): a 4×4 local matrix at `+0x10` (rows at `+0x10`, `+0x20`, `+0x30`, translation `+0x40`; fourth column 0, 1), the cached matrices at `+0x50` and `+0x90`, parent / next sibling / first child at `+4`, `+8`, `+0xc` (`0x1001ceb0`). Slot `+0x2c` (`0x10002e30`) writes the rotation from a quaternion; `+0x44` (`0x10003000`) the translation; `+0x40` (`0x10002fe0`) reads it.
- **Skeleton** (vtable `0x1005672c`): bone count `+0x10`, bones `+0x18`; the bone's parents come from the SDB's `0x2a` names.
- **Skeleton instance** (`0x10023420`, `0xf4` bytes, vtable `0x10056fc8`, based on the mesh instance `0x10027b50`): skeleton per level at `+0x90`, animation per level at `+0xa8`, flags `+0x5c`, clip state at `+0xb4..+0xf0` (below). `0x1002e640` links it; `0x10023490` (`0x100234c0` without a mesh) sets level 0, `0x10023940` the later levels (insertion by distance), `0x10023a70` starts a clip.

## Bone rotation (`0x10002e30`)

`s = 2 / (x² + y² + z² + w²)` (sum in the order x, y, z, w; constant `0x10056278` is 2.0), `xs = s·x`, `ys = y·s`, `zs = s·z`, `wx = w·xs`, `wy = w·ys`, `wz = w·zs`, `xx = xs·x`, `xy = ys·x`, `xz = zs·x`, `yy = y·ys`, `yz = y·zs`, `zz = zs·z`, then rows `(1 − (zz + yy), xy − wz, xz + wy)`, `(xy + wz, 1 − (zz + xx), yz − wx)`, `(xz − wy, yz + wx, 1 − (yy + xx))`.

## Clips and tracks

The ADB's `0x2c` entries are clips: `+0` frames per millisecond (`int × 0.001`), `+4` three floats (velocity), `+0x10` four floats, `+0x20` the index of the clip's first track, `+0x24` int16 frame count, `+0x26` uint16 loop length. The `0x2b` entries are tracks, one per bone from the clip's first track: `+0` rotation start, `+4` rotation time start, `+0x10` rotation count (uint16), `+8` position start, `+0xc` position time start, `+0x12` position count (uint16). The `0x27` block holds the pools: positions (`+0xc`), quaternions (`+0x10`) and the uint16 key times (`+0x14`).

## Sampling (`0x10024380` positions, `0x10024540` rotations)

Count 0 → no sample (the bone keeps its pose); count 1 → the key. Otherwise the keys at or before the time are counted (`time < (float)keyTime` stops):

- inside (neither 0 nor all): previous = key − 1, next = key, span = `times[k] − times[k−1]`, elapsed = `time − times[k−1]`;
- after the last key: previous = last, next = first, span = `(times[0] − times[last]) + frameCount`, elapsed = `time − times[last]`;
- before the first key: the same keys and span, elapsed = `(span − times[0]) + time`.

The fraction is `elapsed / (float)span` (0 when the span is 0). Positions: `fraction · (next − previous) + previous`. Rotations (`0x1002f890`): with `dot = ((p1.y·p2.y + p1.z·p2.z) + p1.w·p2.w) + p1.x·p2.x > 0`, `(p2 − p1) · t + p1`, else `p1 − (p1 + p2) · t`; no normalisation until `0x10002e30`.

`0x10023580` (vtable `+0x5c`) poses every bone: the clip's time is first wrapped when looping (`0x10018790`: a time at or past the loop length `+0x26` becomes `t − trunc(t / L) · L`), the frame count used is `+0x26` for a looping clip and `+0x24` otherwise; while blending (flag `0x20000`) the second clip is sampled the same way and positions blend `(B − A) · f + A`, rotations through `0x1002f890(A, B, f)`; a bone whose clip has no key keeps its pose; a clip index past the animation's clips leaves the skeleton alone.

## Update (`0x10023b10`, vtable `+0x10`)

State: flags `+0x5c` (`0x10000` animated, `0x20000` blending, `0x40000` first clip loops, `0x80000` finished, `0x100000` continue with the second clip index `+0xd8`, `0x400000` second clip loops, `0x2000000` wrapped), first clip time `+0xb4`, rate `+0xb8`, index `+0xbc` (uint16), velocity `+0xc0`; second clip `+0xd0`, `+0xd4`, `+0xd8`, `+0xdc`; `+0xcc` / `+0xe8` which clips advance during a blend; blend factor `+0xec`, its rate `+0xf0`; velocity `+0x1c`.

- The wrapped flag is cleared first. Blending: factor = `rate · dt + factor`; below 1 each advancing clip's time becomes `rate · dt + time` and, when above its last frame (`frameCount − 1`), is wrapped (looping) or set to the last frame; the velocity is `(B − A) · f + A`. At 1 or more the second clip becomes the first (time, rate, index, velocity), looping iff `0x400000`, the blend ends and `dt` becomes `dt − trunc((factor − 1) / rate)`.
- Not blending: `time = dt · rate + time`; from the last frame on (`time >= frameCount − 1`) a looping clip wraps (flag `0x2000000` when the time changed), a clip with `0x100000` restarts from the clip `+0xd8` (rate and velocity from it, looping) and is finished, any other stops on the last frame and is finished.
- `0x10027f40` then adds `dt · velocity` to the position and `dt ·` the UV scroll rates to the shorts at `+0x60`, `+0x62`.

## Matrices and drawing

`0x10014c20` (`Skeleton_ComputeBoneMatrices`, vtable `+0x20`) writes each bone's `+0x90` matrix = local × parent (`0x1002f450`, bones in file order, the root times the given matrix); `0x10014a60` does the same into `+0x50` with the instance and view matrices, which `0x1000acf0` selects for draw command "select transform t" (`+0x50` or, when the renderer's `+0xc8524` is set, `+0x90`). `0x1002f450` computes columns 0..2 of `A × B` for four rows: rows 0..2 as `(a0·b0 + a1·b1) + a2·b2`, the translation row as `((a0·b0 + a1·b1) + b3) + a2·b2`. `0x1000c630` transforms a vertex by that matrix as `((x·m0 + y·m4) + z·m8) + m12`.

## Verified

Every `.SDB` that has an `.ADB` of the same name in the English `LEGO.JAM` has every parent before its child, and every one poses with its first clip at 123 ms into finite matrices.
