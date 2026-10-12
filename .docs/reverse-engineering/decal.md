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

## Drawing the shadow (`0x0043fc20`)

The shadow is drawn only when `0x0043fa50` projected it that frame (vehicle flag `0x10`, which Vehicle_Update clears at its end, `0x0043e5f6`). The squared distance from the camera to the decal's position (x and y from the decal, z the centre's z + 6) decides the alpha: up to 2500 (50 units) it is `0xbf`; between 2500 and 10000 it is `0xbf - trunc((distance - 2500) / 7500 * 191)`; from 10000 (100 units) nothing is drawn, nor when the alpha reaches 0. The alpha goes in through the device's override (slot `0xb8`, mode 1), which the original records as the vertex alpha with alpha test off and depth write on (blend source alpha, destination inverse source alpha). The decal's instance sits 0.4 above the track (`0x004af914`, set in `0x00414950`).

## Verification

`pnpm run render-trace`: the shadows' triangles, UVs and states match in the Royal Knights case and `RACEC1R0` (the port's vertices equal the original's, compared at `0x00415810`). The colour mismatches left (alpha 160 against 191) are the intro frames where the port's camera is not the original's; a texture mismatch of `carshad1` (the original's racer 1 texture hashes unlike the port's) remains open.

## Not decals

The `skid` source the comparison reports is a label: the sky texture and the shadow textures of the racers match `skid` best. The skid marks are not ribbons projected on the track: vehicle `+0x1e4..+0x1f0` are four trail objects (0x334 bytes, made by `0x004927c0` in the pool at race `+0x27d4`, four of them) that project a decal per stretch of the wheel's path with `0x00491fa0`. They exist only while the tire smoke runs (vehicle flag `0x8`). The oil slick, the explosion scars and the crane shadow use the decal object too (see below).

## Skid trails (`0x00491c70`..`0x00492870`)

Vehicle `+0x1e4..+0x1f0` hold the four wheels' trails, taken from the pool at race `+0x27d4` (four 0x334-byte trails for all racers, `0x00492680`, searched from the first by `0x004927c0`). Each is a decal (`+0x4`, 12 triangles, depth 15) and a ring of three copies of it (`+0x120`, 0x9c apart).

- **Wheel flags** (vehicle `+0x1f4`, `0x0043f1e0`): bit 0x1 asks for a mark, 0x2 means the wheel stood on the ground, 0x4 a cooldown (`0x0043e102`, one second). Set by the tire smoke start `0x0043dc00` (every wheel when the car body spins, else the rear two) and cleared by `0x0043dcd0`, which also lets the trails go with a 1000 ms fade. While the tire smoke runs (vehicle flag 0x8): a wheel asking for marks that stands on the ground sets 0x2; one off the ground for more than 150 ms loses it. The flags then follow the car: spinning body, every other bit set; racer flag 0x40 (turbo), rear wheels on; otherwise the side the velocity direction leans to, by its dot product with the second row of the display frame.
- **Trails**: a wheel with the bit and no trail takes one (1000 ms, or 250 ms with vehicle flag 0x100); a wheel without the bit lets its trail go at once. A trail whose duration is 1000 while the wheels spin is let go too; a short one never is (its duration is 248, the test compares with 250). The width is vehicle `+0x1a0` for the front wheels and `+0x1a4` for the rear.
- **Stretches** (`0x00491fa0`): the wheel's point in the display frame; a move of 0.1 or more puts the decal between the last point and this one, 6 above their middle, as wide as the mark and as long as the move, projecting down. `0x00491e20` projects it, joins it to the last finished stretch (`0x00492470`), and after a quarter of the duration copies it into the ring (`0x00492220`).
- **Image**: `skid`, or `trbskid` after a level 1 or higher turbo (`0x0043fd30`), back to `skid` by `0x0043fd70` and the reset; the alpha of a fade is the image's alpha byte (`0x7f`) scaled.

Verified with `render-trace` on the new `Royal Knights, power slide` case (accelerate, then two power slides from frame 235): the marks match the original's triangles at frames 240, 260, 340 and 400.

## Oil slick, explosion scar, crane shadow

`getEffectViews` lists them as `DecalView`s (picture, placement, triangle limit, alpha, draw distance); the viewer's `race-effect-decals.ts` projects each every frame (the engine projects once, or per growth step; the triangles are the same) and `race-decals.ts` hands them the eye.

| Decal        | Placement (call site)                                                                                                                                                                           | Picture   | Triangles         | Drawn                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oil slick    | `0x004573a0` (`0x004575a3`): centre (x, y, z + 5) of the ground point, projection (0, 0, -1), up hint (1, 0, 0), size 15 x 15, reach 15                                                         | `oilslck` | 16                | While the effect is active, opaque (alpha blend off, white vertices, depth write on); seen in the oil case at frames 305-307                                                 |
| Scar         | `0x00421850`, `0x00421520` (`0x004218f5`, `0x004219c9`): ground bursts only (the barrel); centre (x, y, z + 5), size (s, s), reach 15, s = (width - 0.1) x progress + 0.1                       | `exscar`  | 10                | Re-projected each frame while growing, drawn at alpha 180; width 15 (plain pool) or 5 (spiked); then fades linearly 180 to 0 over 5000 ms at its full width                  |
| Crane shadow | `0x00490330` (`0x00490441`): the crane's bone point (below), projection (0, 0, -1), up hint the first row of the crane instance's frame (`Frame_GetAxes`, `0x00403c90`), size 13 x 13, reach 15 | `crneshd` | 32 (`0x0048ff50`) | Each frame the crane is not idle (`+0xc` is not 1) and the camera is strictly within the instance's `+0x84` (360000), `0x00490460` draws it when it was projected that frame |

The crane's update (`0x00490190`) puts the crane's frame (`+0x10`, position at `+0x14`) on the world point of bone 3 of its skeleton (the bone's parent chain, the instance scale, then the frame transform: `getSkeletonInstanceBonePosition`) before its signal logic, so the shadow stands where the previous update left it; the frame is the origin until the first update (the shadow is projected there on the frame of the crane's Begin, where the track holds no triangles).

### Verification

`pnpm run render-trace` and the decal trace (`decal-trace.trace.spec.ts`, `reverse-engineering/emulator/decal_trace.py` records the triangles `0x00415810` adds):

- Oil slick (Royal Knights, frames 305-415) and barrel scars (three bursts, every third frame from 386): the port's triangles equal the original's (tolerance 0.001).
- Crane shadow (`RACEC0R1`, frames 386-430): the camera never nears the crane, so the recorder opens the instance's draw distance (`+0x84`) from the crane's update on. The original then poses the crane's skeleton only while it draws it, so the pose it projects at is a stale one that the port cannot reproduce; the comparison takes the original's projection point and compares everything else (up hint, size, reach, triangle limit, triangles, picture coordinates): equal. **Hypothesis**: with the camera near, the animated pose of bone 3 is the port's (same code as the signal position `getObjectBonePosition`); not compared. The distance gate itself (`+0x84` = 360000 for the crane, strict) is read from the original's log, not exercised.
- The computer racers' oil slick lands about 34 frames earlier in the port than in the original (frame 436 against 470 in `RACEC0R1`): open, an AI timing difference, not a decal one.
