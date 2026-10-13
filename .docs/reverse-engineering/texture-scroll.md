# Texture scroll of mesh and skeleton instances

Source: `GolDP.dll` (`0x10027f40`, `0x10028030`, `0x10028110`, `0x10028140`, `0x1000c630`, `0x10008f70`) and `LEGORacers.exe` (`0x00411700`, `0x00411730`, `0x0048b240`).

## What the original does

- **Fields.** Every instance (mesh class `0x10027b50`, skeleton class `0x10023420`) keeps two 16-bit offset words at `+0x60` (u) and `+0x62` (v) and two rates at `+0x64` (u) and `+0x68` (v), all zero at construction. Flag `8` of `+0x5c` is set by the rate setters.
- **Rate setters** (`0x10028110`/`0x10028140` in the DLL, `0x00411700`/`0x00411730` in the exe, same code): `rate = ftol(scrollPerSecond * 65.535)` (`0x4283126f`), stored as an integer.
- **Update** (`0x10027f40`, mesh vtable `+0x10`, called by the world update `0x00416090` for every mesh instance, and by the skeleton instance step `0x10023b10` at its end): when a rate is non-zero, `offsetU += (short)ms * (short)rateU` and `offsetV += (short)ms * (short)rateV`, 16-bit `IMUL` and `ADD`, so the offsets wrap at 65536 (one texture).
- **Draw** (`0x10028030`): with flag `4` or `8` and a non-zero word it calls renderer slot `+0xa8` (`0x10008f70`) with `u = word * 2^-16` (`0x37800000`) and `v` likewise; the renderer stores them (`+0xc83a0`, `+0xc83a4`, flag `+0xc83f4`) and the vertex transform `0x1000c630` adds them to the texture coordinates of every vertex of the instance (`FADD` after the transform, stored as float32).

## Where the rates come from

1. **World keyword `0x3f`** (two floats, per second) of a mesh, skeleton or BSP instance: `World_LinkInstances` `0x1002e640` calls the setters when the entry's flag `8` is set. Examples: `mmlava`, `lava01`, `falls`, `wtrfall`, `amazon`, `pool`, `rkbflag` (mesh), `shield0..3`, `warpprt` (POWERUP.WDB), `dfboom` and `lgtbeam` (BLENDED.WDB).
2. **Hazard `0x36`** (`TextureScroller_Update` `0x0048b240`): each update adds the milliseconds to a clock (float32, wrapped at 10,000), takes `table[(-0x100 - ftol(clock * 1e-4 * 2pi * -1024/2pi)) & 0x3ff]` from the cosine table `0x004bf7ec`, and sets the two rates of the instance it found by name (mesh instances, then skeleton instances, in the track world, then the blended world) to `float1 * table` and `float2 * table` (each stored as float32 first). `titwater` (Titan Station) and `rktrans` (Royal Knights) scroll this way; their worlds carry no keyword `0x3f`.

## The port

- `world-animation/controller/texture-scroll`: `createTextureScroll` (keyword `0x3f`), `getTextureScrollWithRates` (the exe setters), `getAdvancedTextureScroll` (`0x10027f40`), `getTextureScrollOffsets` (`0x10028030`). `advanceWorldAnimation` advances mesh instances and `advanceSkeletonInstance` skeleton instances.
- `hazard/controller/scroller` sets the rates each update.
- Viewer: `race-viewport` `showHazards` hands the offsets of both worlds to `scene-object` `setInstanceTextureOffset`, which gives the instance's meshes their own `uv` attribute (the shared geometry is not touched) and writes `model uv + offset`. The pixel trace and render trace read the same attribute.

## Verified

- Differential specs (`texture-scroll.differential.spec.ts`, both x87 precisions, 3,000 cases each): `Instance_ApplyVelocity` `0x10027f40` through the real mesh vtable (offset words after random rates, milliseconds and offsets, bit for bit) and `Instance_SetScrollRateU` `0x10028110`. The rate is tested for positive scrolls only (a negative rate reads back as a NaN pattern the harness cannot compare); the update test covers every low 16-bit rate.
- Render trace (`uv-scroll.trace.spec.ts`, the demonstration of four races at frames 250 and 340): triangles whose `u`/`v` differ from the original's, without the scroll and with it: `titwater` 85 and 0, `rktrans` 29 and 0, `aaaamzon` 45 and 0, `pswater` 79 and 3 (a corner 0.37 px off in the untrusted frames of `psp`).

## The background world

The sky world (`BACKGRD.WDB`) is advanced by `Sky_Update`, which calls `0x00416090`. The last race's `planet` carries keyword `0x3f` (0.3, 0): rate `ftol(0.3 * 65.535) = 19`, so 627 words (0.009565 of the texture) per 33 ms frame, the u scroll PR #138 measured. The viewer's backdrop scene object advances it itself (`SceneInstance.textureScrollPerSecond`). The render trace of the planet cannot show it yet: its triangles still pair with another texture and depth state (render-coverage.md item 7), so only the unit spec (`texture-scroll.spec.ts`) proves the per-frame step.

## Open

- `burn2`/`burn4` flames (`DT*FLA*`) and `sbfan` fans (`SHEOUT*`) are not scrolled by this mechanism in the data (no keyword `0x3f`, no scroller): their off-by-a-frame phase is another cause (hypothesis: material animation or the clock of the flipbook).
- BSP tree instances with keyword `0x3f` get rates but the world update loops only mesh and skeleton instances, so they never scroll (as in the original, by the loops of `0x00416090`).
- The remastered layer's replaced textures need no change: the offsets live in the geometry.
