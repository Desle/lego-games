# Render coverage: is everything the original draws drawn by the port?

[render-trace.md](render-trace.md) and [pixel-trace.md](pixel-trace.md) check a few scenarios in depth. This sweep checks **breadth**: every race of `LEGORACE.RCB` (26 entries: 12 forward, 12 mirrored second passes, the final race and its mirror; `test` has no circuit), a whole first lap each, and a list of what the original draws that the port has no partner for (and the reverse). It reports; the fixes are separate tasks, one per item below. The draw-distance and level-of-detail items (2 and 9) are done: see "What is drawn when" below.

## Running it

```
pnpm run render-coverage                                  # all 26 races, 1.5 to 2 hours in one process (nine parallel runs with RENDER_COVERAGE_RACES: about 40 minutes)
RENDER_COVERAGE_RACES=rr,rr2 pnpm run render-coverage     # per race (catalog names; see the table below)
```

Skips without the original files or the emulator's virtualenv; not part of `pnpm run ci`. Options: `RENDER_COVERAGE_INTERVAL` (frames between samples, 90 = 3 s), `RENDER_COVERAGE_MAXIMUM` (probe limit, 6000), `RENDER_COVERAGE_OUTPUT` (default `packages/lego-racers-web/.render-coverage/`, gitignored). Each race writes `<name>.json`; the last test of the run writes `summary.md` (all ranked tables, from every JSON in the folder). Races are independent, so several runs can share one output folder in parallel.

## Method

- **Scenario: the demonstration.** `localPlayerCount: 0` (`Race +0x3350`; the front end's idle demonstration): the computer drives racer 0 and the camera follows it round the track, so a lap shows every part of the track. The port runs the same scenario (`isDemonstration`, ported). The emulator and the port use the same frame clock (33 ms).
- **Frames.** A port-only probe finds the frame racer 0 completes its first lap (`lapEndFrame`) and the frame the first racer finishes. Recorded: frames 5, 100, 170 (introduction, countdown, release), then every 90 frames (3 s) from 250 to the lap end, the lap end, and the finish +5 and +60. 17 to 51 frames per race, 718,421 original triangles in the 701 trusted frames.
- **Comparison.** As the render trace: the original's triangles after its own culling against the port's three.js triangles under the original's model matrices (80 candidates, six cars of about ten parts), matched by corners, UVs, colour, state, texture. Per original texture (named by the port texture it looks like; failing that by a search of every bitmap in `LEGO.JAM`) the unmatched triangles are tallied with state (`opaque`, `alpha_test`, `blend`, `additive`, colour operation), screen pixels, frames, screen box and depth. Port triangles without partner are tallied by port object. Triangles both draw with another texture, UV, colour or state are tallied by port object.
- **Cut pieces (since `fix/visibility-lod-sweep`).** The driver cuts every triangle against the viewport edges and the depth range 5 to 800 (GolDP.dll `0x1000c630` builds out-codes from the signs of x, y, z and w - x, w - y, w - z; the original's farthest corner is exactly 800.000 in 138 vertices of `tit` frame 880), so a triangle that reaches past them reaches Direct3D as a smaller polygon with new corners on the edge. `compareRenderFrame` leaves such triangles out of its count, and the first sweep tallied each of them as "no partner" (`rkroad4`: 556 of 1,869 in `rkr`). A cut piece now counts as matched when all its corners lie in the polygon the port's whole triangle leaves after the same cut (viewport, near 5, far 800; `clipped-polygon`) and the texture agrees (or the original's state uses none). The tables show them in a column of their own.
- **Port triangles outside the depth range.** The race camera of the viewer has the original's planes (near 5, far 800, was 0.5 and 20000), so a port triangle wholly nearer than 5 or farther than 800 is not projected (`projectWorldTriangle` with the depth range), as the GPU would drop it.
- **Untrusted frames.** A frame where less than 60 percent of the original's triangles match means the port's race has left the original's (simulation divergence of the computer racers, see [golden-trace-computers.md](golden-trace-computers.md)); it is listed but not tallied. `psp`/`psp2` lose 39 of 51 frames, `ipp` 19, `ipp2` 13, `aar` and `att2` 10 each; the rest at most 2.
- **What the numbers are not.** Frames 5 and 100 (the introduction and the countdown camera) are camera mismatches: the comparison projects the port's world with the original's matrices, so a wrong camera is invisible to it, but the viewer's culling uses the port's own camera, and a prop the original's camera sees and the port's does not shows as missing (`titree8` in `tit` frame 100: the sphere is 13 units outside the right plane of the port's frustum). A camera difference is not fixed here. `Pixels` is the sum of the unmatched triangles' areas over the sampled frames (overlaps counted twice), a ranking weight, not coverage. A texture the matcher cannot name is `unknown <hash>`. Texture names are the port's best look-alike: near duplicates (`rrlite2`/`rrlite4`) can swap.

## Races

| Race | Folder   | Mirrored | Lap end frame | Finish frame | Recorded | Untrusted | Mean share matched | Lowest |
| ---- | -------- | -------- | ------------: | -----------: | -------: | --------: | -----------------: | -----: |
| igp  | RACEC0R1 | false    |          1430 |         3827 |       20 |         0 |              0.979 |  0.938 |
| dfd  | RACEC1R0 | false    |          1505 |         4217 |       20 |         0 |              0.994 |  0.989 |
| mmm  | RACEC0R3 | false    |          1237 |         3413 |       17 |         0 |              0.994 |  0.974 |
| dad  | RACEC0R2 | false    |          1404 |         3733 |       19 |         0 |              0.987 |  0.896 |
| tit  | RACEC1R1 | false    |          2543 |         3919 |       32 |         0 |              0.989 |  0.932 |
| rkr  | RACEC0R0 | false    |          2330 |         3476 |       30 |         0 |              0.993 |  0.976 |
| ipp  | RACEC1R3 | false    |          2774 |         3938 |       35 |        19 |              0.942 |  0.614 |
| ama  | RACEC1R2 | false    |          3035 |         4025 |       37 |         0 |              0.967 |  0.786 |
| frk  | RACEC2R0 | false    |          3651 |         4030 |       44 |         0 |              0.990 |  0.946 |
| psp  | RACEC2R1 | false    |          null |         4269 |       51 |        41 |              0.902 |  0.603 |
| att  | RACEC2R2 | false    |          3682 |         5318 |       45 |         1 |              0.947 |  0.677 |
| aar  | RACEC2R3 | false    |          3228 |         3613 |       40 |         7 |              0.911 |  0.603 |
| igp2 | RACEC0R1 | true     |          1501 |         3806 |       20 |         0 |              0.946 |  0.692 |
| dfd2 | RACEC1R0 | true     |          1679 |         4275 |       22 |         1 |              0.974 |  0.888 |
| mmm2 | RACEC0R3 | true     |          1375 |         3436 |       19 |         1 |              0.982 |  0.913 |
| dad2 | RACEC0R2 | true     |          1521 |         3772 |       21 |         0 |              0.938 |  0.694 |
| tit2 | RACEC1R1 | true     |          2543 |         3919 |       32 |         0 |              0.976 |  0.708 |
| rkr2 | RACEC0R0 | true     |          2337 |         3486 |       30 |         0 |              0.974 |  0.615 |
| ipp2 | RACEC1R3 | true     |          2872 |         3905 |       36 |        13 |              0.808 |  0.611 |
| ama2 | RACEC1R2 | true     |          3031 |         4023 |       37 |         0 |              0.971 |  0.780 |
| frk2 | RACEC2R0 | true     |          null |         3987 |       48 |         1 |              0.980 |  0.854 |
| psp2 | RACEC2R1 | true     |          null |         4278 |       51 |        38 |              0.866 |  0.602 |
| att2 | RACEC2R2 | true     |          3916 |         4717 |       47 |         9 |              0.895 |  0.602 |
| aar2 | RACEC2R3 | true     |          2645 |         3652 |       33 |         0 |              0.969 |  0.833 |
| rr   | RACEC3R0 | false    |          1877 |         3424 |       25 |         0 |              0.949 |  0.794 |
| rr2  | RACEC3R0 | true     |          1895 |         3496 |       25 |         2 |              0.949 |  0.825 |

`null` lap end: racer 0 does not count a lap before the first finish in the port's probe (hypothesis: the port's route follower and the start-line zone disagree on `psp`, `frk2`; the sweep then ends at the finish). The finish frames are the first racer of the field finishing (about 3,400 to 5,300 frames, 2 to 3 minutes of play).

## Totals (all 26 races, trusted frames)

Before: the sweep as first written, on the viewer of `main` (`cov-visibility-v1`); after: the same 26 races with the cut-piece accounting and the fixes of "What is drawn when" below (`cov-visibility-v2`). The same 719,351 original triangles in the 701 trusted frames.

| Original triangles with no partner                         |                          Before |                       After |
| ---------------------------------------------------------- | ------------------------------: | --------------------------: |
| Counting every cut piece as missing (the first reading)    |          111,277 (15.5 percent) |                     109,831 |
| Cut pieces whose whole triangle the port has (not missing) | 69,632 (viewport and near only) | 72,234 (plus the far plane) |
| **Really without a partner**                               |        **41,645 (5.8 percent)** |    **37,597 (5.2 percent)** |
| Port triangles without a partner in the original           |                         282,517 |                     189,758 |

By mechanism (really unmatched original triangles, port-only triangles):

| Mechanism                                                                                                                                          | Original only, before |  after | Port only, before |   after |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------: | -----: | ----------------: | ------: |
| Props and track objects drawn past the far plane or outside the frustum (item 9, fixed)                                                            |                     - |      - |           107,446 |  13,833 |
| Racers: car and driver parts (poses of the computer cars, `candidateCount`; simulation, not this sweep)                                            |                14,177 | 14,709 |           169,510 | 170,347 |
| Track surface and props: introduction camera (frames 5, 100), the last race's planet, moving track parts, `att`/`att2`/`psp` simulation divergence |                17,134 | 12,485 |                 - |       - |
| Sky dome pieces (the dome's root has no whole triangle to choose its matrix by)                                                                    |                 5,840 |  5,916 |             3,767 |   3,818 |
| Shadows (decals)                                                                                                                                   |                 2,162 |  2,162 |                 - |       - |
| HUD: minimap, fades                                                                                                                                |                 1,441 |  1,441 |                 - |       - |
| Effects, particles                                                                                                                                 |                   891 |    884 |             1,794 |   1,760 |

The port-only rows of the props and track objects are the sum of the sources that are not racers, sky or particles; the plain props (`*/plainmat`, `*/nonemat`: ships, totems, towers) went from 31,806 to 430 triangles.

## Ranked list

Ranked by visibility (pixels x frames), in groups with one likely cause; "never drawn" means no port object uses the texture in any race.

### 1. Sky dome: **resolved, a measurement artifact** (the port's draw state is the original's)

- **Checked against the original's draws** (`render-trace-sky-and-fade.trace.spec.ts`, races `RACEC0R0`, `RACEC1R0`, `RACEC3R0`, frame 100): the original's first draws of a frame (before the first depth-tested one) are the dome, in the state `Z_ENABLE` 0, `Z_WRITE_ENABLE` 0, colour operation select-diffuse, vertex colours only (blue `95,95,255` at the top to `250,250,120` at the horizon in `RACEC0R0`); the texture the matcher names (`e0b579ecb2425186`, `skid`, `unknown eea37d3f06eea066`) is only whatever the device had bound last. The port's `/skymat` triangles are `select_diffuse`, no texture, no depth test or write: the same state. The "texture, UV, depth, colour mismatch" lines below pair port dome triangles with unrelated original triangles at nearby positions.
- **Why the dome counts as unmatched:** the original's driver clips the dome against the viewport (16 triangles at frame 100 of `RACEC0R0`, corners at x 640, y 0 that no port corner has) while the port draws whole triangles, so no triangle has a partner; pixels agree: the sky region of the Royal Knights case differs from the original by 2 levels on average (corner pixels 93,93,255 against 94,94,255). The ring colours are the keyframes of `0x0041ccb0` (ported).
- Cars' vertex-coloured bodies (below) are still the computer-car divergence of the measurement.

(Original text of the item, kept for the record:)

- Evidence: the original's vertex-coloured, stale-texture draws (`unknown eea37d3f06eea066 256x256`, state `opaque/select_diffuse`: 8,755 of 16,856 triangles unmatched, 58 M px) and the `skid` label (the sky texture and shadows match `skid` best, [decal.md](decal.md)): `skid` opaque/select_diffuse 5,023 of 8,224 and `skid` blend/modulate 2,402 of 4,052 unmatched, about 130 to 260 triangles in nearly every frame. The port's `/skymat` object is the extra (3,310 triangles in 175 frames) and the mismatch table says why: texture `ac389648b9db3c0c -> none` (967 triangles in 172 frames), UVs `(0.75, 0.5) -> (0, 0)`, `colorOperation modulate -> select_diffuse`, depth test and write `true -> false`, diffuse `243,243,243 -> 0,0,0` (sampled frames; the sky also animates through keyframes, `0x0041ccb0`).
- Likely cause: the dome's material `skymat` loses its texture in the viewer (`sky-object`), is drawn without depth, and its colour keyframes (`Sky_Update` `0x0041ccb0`, ported as `advanceSky`/`getSkyVertexColors`) are not what the original draws at those times. pixel-trace.md already lists the sky's brightness as open.
- Candidates: `0x004907f0` (dome builder, ring colours), `0x0041ccb0`, `0x0041c550` (Sky_Load assigns the material); port `sky` module and `services/sky-object`.
- Part of this row is the computer cars' vertex-coloured bodies (`BKCM/all`, `KKCM/all`, `GMCM/black` ...: 16,854 + 7,286 + 6,949 + ... port triangles without partner, and the same models unmatched on the original side): both draw them, at poses that differ, so it is **measurement of computer-car divergence** (see Totals), not a missing draw. A fix task should first split sky from cars (draw order: the sky is drawn first, depth 100).

### 2. Far track surface: **resolved, a measurement artifact plus the far plane**

- The "30 to 40 percent of a textured surface" were triangles the original's driver had cut at the viewport edge (the comparison does not count them, the first sweep tallied them as missing) or at the far plane 800. Their screen boxes ran from 0 to 640 and their depths from 8 to 800 because they lay on the edges. With the cut pieces matched to their whole port triangles, `rkr` goes from 3,179 to 274 unmatched triangles, `tit` from 3,483 to 309 (see Totals).
- The BSP leaf choice, the level distance and the sphere test were already the original's for the track tree (`getVisibleBspLeaves`, finding 6 of render-trace.md). What was not: the far plane itself (below, "What is drawn when").

### 3. Truncated walls: textured surfaces drawn with another texture, UV or colour

- Evidence (mismatch table, texture/UV/colour kinds on shared triangles): `water01/titwater` (tit, tit2) 1,677 triangles with UV `(1.9393, 0.3319) -> (1.4136, 0.3319)`: the port's `u` stays at 1.4136 while the original's runs on; `pswater/pswater` (psp) 839; `rkwater2/rktrans` (rkr) 185 (`v` stuck at 0.1640); `fallls/iawater` (igp) 120; `wtrfall/aaawatr`, `pool/aaawatr3`, `amazon/aaaamzon` (ama) 203 + 110 + 464; `falls/dffall` (dfd) 189; `energy1/2 araenrgy` (aar) 250; `mmlava/mmlava`, `lava01/02` (mmm, att) 381 + 133; `warpent/warpent` and `arrow1/4 rrcurb` (rr) 186 + 285; `DT0FLA1/2 burn2` flames 1,520 (small phase shifts, 0.003 in `v`: the port's scroll runs a frame or two off); `SHEOUT0..2/sbfan` 1,800 (the fan UVs drift). See the animated-material table below.
- Cause (fixed, see [texture-scroll.md](texture-scroll.md)): the instance texture scroll of `Instance_ApplyVelocity` `0x10027f40` was not ported. Measured on frames 250 and 340 of the demonstration: `titwater` 85, `rktrans` 29, `aaaamzon` 45, `pswater` 79 triangles differed in `u`/`v`; with the scroll 0, 0, 0 and 3 (`uv-scroll.trace.spec.ts`). Open: flames (`burn2`) and fans (`sbfan`) are not driven by this scroll in the data (no keyword `0x3f` or scroller on them); their phase is still to trace.

### 4. World sprites (`0x37`): fixed

- Done: the draw (`Renderer_DrawSprite` `0x10009a70`, called per sprite by `World_DrawSprites` `0x10018270` after the world's instances) is located and ported: position, facing (a camera-facing rectangle; with the `0x38` axis it turns around the axis), size, distance limit, white vertex colours, the diagonal, the texture row order and the draw order. See [world-sprite.md](world-sprite.md) (it also corrects the old guess that `0x004047b0` has to do with sprites: it is the camera lock). Of the sprites' original triangles every one the port draws has its partner at the same corners, texture coordinates and colour in forward and mirrored races (`rkr`, `rkr2`, `mmm`, `mmm2`, `dad`, `frk`, `aar2`, `dfd` re-swept); the case `Royal Knights, world sprites` (pixel trace) and `world-sprite.trace.spec.ts` hold it.
- Left: the flame flipbooks of `adtorch` (item 6's mechanism), the colour-key state (`isAlphaTestEnabled`, finding 9 of render-trace.md), and the race preview's four sprites in the front end.

### 5. Screen overlays outside the world comparison

- **Race start fade-in** (all 20 races whose frame 5 is trusted; 40 triangles, 6.1 M px): a full-screen `blend/select_diffuse` quad at frame 5 (depth 1.0). It is the screen fader entry `0x00433525` (500 ms fade-in at race start). **Resolved: it is drawn** (pixel-trace.md finding 6; the viewer's `screen-fade-overlay`, after the scene), the sweep's world comparison never sees it. `render-trace-sky-and-fade.trace.spec.ts` compares the port's alpha with the original's quad on frames 3, 5, 8, 12, 15, 16, 17, 18 of `RACEC0R0` (demonstration and one player): 187, 154, 103, 36, 0, 0, then none, identical (black, source alpha over inverse source alpha, no depth). The finish fades are wired (pixel-trace.md finding 9). The finish fades (`0x00434ee8`, `0x004351ab`) were not seen at finish +5 and +60 (the fade is later); a longer finish capture would show them.
- **Minimap** (`128x128` blend quad at 497,337-625,465, depth 1.0, one new texture per race: `unknown 58f7dfb50eb30ee5` in rkr, `52a6ec68e660cf8e` aar ...): HUD `0x004249b0`; the port's HUD draws a minimap (`race-hud`, compared by the HUD comparison of render-trace.md), not by the world list; the texture is built at race load, so it is "unknown" here. Not a gap.

### 6. Material flipbook animation (MAB): the last race's wall lights (fixed, see below)

- **Answer: yes, the last race has wall lights the port misses.** `RACEC3R0` `TEST.MAB` has 8 materials and 2 entries (`keyword27Values` `[0,4]` and `[4,4]`, length 8, rate 0.03 per ms): a flipbook cycling the light materials. The original draws eight textures, `rrlite1` to `rrlite8`, on the wall light faces (rr: `rrlite7` 317 triangles, `rrlite2` 391, `rrlite3` 354, `rrlite6` 280, `rrlite8` 113, `rrlite4` 179, `rrlite5` 61, `rrlite1` 52; plus the `select_diffuse` variants). The port has port objects for `rrlite4` and `rrlite8` only (`rrtrack/rrlite4`, `rrtrack/rrlite8`); `rrlite1`, `2`, `3`, `5`, `6`, `7` have `portSources` empty. Unmatched: `rrlite7` 92 of 317, `rrlite6` 186 of 280, `rrlite3` 96 of 354, `rrlite2` 55 of 391, `rrlite5` 45 of 61, `rrlite1` 39 of 52 (plus 25 to 56 percent of the `select_diffuse` lines); mismatch `texture rrlite2 -> rrlite4` and `rrlite3 -> rrlite4` on `rrtrack/rrlite4` (644 triangles in 23 frames). The wall also flashes red and blue in the original (`rrcwndow`, `rrcelng`, `rrpanel3`, `rrroad` diffuse flips between `35,35,255` and `255,35,35`: colour mismatches in both directions on the same triangles); **hypothesis**: the lights are one material per bulb whose texture index is rewritten by the animation, the wall's tint comes from a second effect (vertex colours); the sweep cannot tell the order.
- Likely cause: the sim carries each world's `MaterialAnimationRuntime` with the chosen table row (`MaterialAnimationPlayback.tableIndex`, `getAdvancedMaterialPlayback`, `0x004104c0`); in the exe the row is written to the world's material value table (`0x00410750`: `[world + 8][materialIndex] = row value`) which the draw (`Renderer_ApplyMaterial` `0x1000a2c0`) uses to pick the material's texture. Only the emitter system reads the row (`emitter-system.ts`); the viewer never maps it onto the scene's materials.
- Same mechanism, other tracks (their `TEST.MAB`): RACEC1R0 (17 materials), RACEC1R2 (2), RACEC2R0 (about 140), RACEC0R3 `MGMMN.MAB` (18), RACEC0R2 `BLOWUP.MAB` (11, the sphinx) and the sprites' flame flipbooks (`adtorch`).
- Size: medium (apply the row to the scene material's texture each frame; the textures of the chain are loaded).

- **Fixed** (`fix/material-flipbooks`, traced in [material-animation.md](material-animation.md)): the exe writes the row's material into the target level's material table (`0x004104c0` to `0x00410750`), the reference's value being the slot; the world link (`0x1002e640`) hands each entry its target. The viewer applies the writes of the track world every frame to every batch reading that table and slot (`rrtrack` slots 16 and 17 for the wall lights; also `dfwin`/`dfmajwin` in dfd, the `ktflgw0*` flags and `bats0*` in frk, `aa_blimp` in ama, `mmcode*`, `mmrocon`, `mmfactlt`, `mmfact` in mmm). Measured on `rr` (`RENDER_COVERAGE_RACES=rr`): texture mismatches on `rrlite*` port objects 423 to 96 triangles, all `rrlite*` mismatches 615 to 288, and the port now draws every `rrlite1` to `rrlite8`. The original-side unmatched counts of the `rrlite*` rows do not move: what remains is the lights' vertex colours (original `20..213` against the port's constant `75`) and `select_diffuse` draws, the wall tint effect, not the flipbook. Pixel trace `RACEC3R0, wall lights`: the share of the pixels the original paints with `rrlite1` to `rrlite3` that differ fell from 9.2 to 1.4 percent. The blended and local worlds' animations (`BLOWUP.MAB`, emitter pools) have no instance target and are unchanged; sprite flames wait for the sprite task.

### 7. The last race's planet: only the texture scroll differs

- **Checked against the original's draws** (`RACEC3R0`, frames 60 to 600; case `RACEC3R0, sky and planet` in `pixel-trace-cases.ts`): the original draws the planet (`planet`, 64x64, mesh in the backdrop world) after the dome in the state depth test and write off, modulate, vertex colours `0c2128`-ish (dark blue); the port's planet triangles have the same texture, colour and state (mean colour of the planet region 12.5,37.6 against 13.6,37.7 on frame 250). The "texture, colour, depth" mismatches below pair port planet triangles with unrelated original triangles on frames where the camera differs (frames 5 and 250); the 4,046 "extra" triangles are the whole sphere against the original's viewport-clipped ones.
- **What really differs: `u` scrolls in the original and is constant in the port.** The same planet triangle has `u` 3.4588, 3.8414, 3.6251 on frames 60, 100, 600 in the original and 2.8752 on every frame in the port: 0.009565 per 33 ms frame (0.29 per second), wrapping, frame `n` showing the scroll of `n + 1` steps. This is the instance texture scroll of `Instance_ApplyVelocity` `0x10027f40` (item 3): **not fixed here** (the UV scroll task owns it); when it lands, the case's threshold can drop.
- Also seen: at frame 5 of `RACEC3R0` (player scenario) the original's camera shows the starting tunnel without the cars, the port's shows the cars (38 percent of the frame differs); the Royal Knights introduction matches since the camera lock (`0x004047b0`), so the final race's introduction camera is **open**.

(Original text of the item:)

- `planet/planet` (rr, rr2): the original's planet triangles (1,054 of 1,442 `planet` modulate unmatched) pair with port triangles of another texture (`texture pupgree2/pupred2 -> planet`), UVs `(0, 0.75) -> (1.8486, 1.3789)` (1,430 triangles), diffuse `243,243,243 -> 41,151,187`, depth `true -> false`; the port also draws 4,046 `planet/planet` triangles the original does not pair. A skeleton or UV animation of the planet (rotation) is not advanced like the original, or the dome is drawn at the wrong depth state (hypothesis). Candidates: `0x10027f40` (instance UV scroll), `0x10023b10` (skeleton instance step); see item 3.

### 8. Emitter particles and trails (rare frames, computers' power-ups)

**Swept by class in [effects-sweep.md](effects-sweep.md)**: the snow, the smoke vent, the oil slick's bubbles, the turbo's smoke, the flame and fan scroll and the shield's alpha are fixed there; the cannon and missile trails, lightning and the remaining unpositioned emitters are listed there as open. The text below is the original finding.

- Never drawn by the port: `csmoke` (att, att2: 72 triangles), `watmist4` (ama: 12), `mslstrk` additive (aar2, rr, rr2: 180 triangles, additive missile streak), `canstrk` (frk, igp, rr: 39), `litflash` additive (att2: lightning flash), `welder`, `welder2` (mmm: 4). They appear in a handful of frames each, when a computer uses a power-up or an emitter fires. Overlaps the three bugs under repair (capture ship, debris, sparkles) for the power-up ones; `csmoke`, `watmist4` and the welder belong to the track's `EMIT*.EMB` pools (`hazards-and-emitters.md`) and are separate tasks.

### 9. Port objects the original does not draw: props **fixed**

- Props (`ship01`, `longship`, `mosscot1`, `prntdum`, `aa_plane`, `arktp`, `palm00`, `forbid`, `drop`, `kttowr`, `tithead`, `tittot3`, `tower`, `cbase` ...) were drawn when the original culled them: the viewer applied the level distance and the sphere test only to instances the race simulation tracks (hazards, animated skeletons), and let three.js cull the rest with a far plane of 20,000. Fixed, see "What is drawn when": the plain props went from 31,806 to 430 port-only triangles, all port-only track objects from 107,446 to 13,833 (the remainder are the track triangles that straddle the far plane, which the comparison reads uncut, and animated or moving parts).
- Cars: see item 1 (the poses of the computer cars; `KKCM/all` and the like are 170,000 port-only triangles in the sweep and unchanged).
- State: port enables the alpha test where the original does not (`isAlphaTestEnabled false -> true`): car parts (`KKJMW` 11,515 triangles ...), `rktk/rktowtop`, `rktk/rkfence`, `ENHABRIK/pubrickw`, `PUBRICKY/*`, shadows `/carshad0` (1,215). The viewer's alpha test stands in for the colour key ([render-trace.md](render-trace.md)); not a visible gap.

### 10. Measurement limits (do not become tasks)

- Computer cars diverge from the original after about frame 211 (power-ups) and on `psp`, `ipp`, `aar`, `att2` earlier; the sweep counts those frames untrusted. Cars' vertex-coloured bodies are the largest "missing" and "extra" entries because their poses differ.
- The matcher names the original's stale-texture vertex-colour draws `eea37d3f06eea066` and the sky `skid`.

## Animated materials the port leaves static or off-phase

| Animation                        | Where                                                                                                                                                            | Evidence in the sweep                                 | Mechanism / candidate                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| MAB flipbook (texture index)     | rr, rr2 wall lights `rrlite1..8`                                                                                                                                 | 6 of 8 textures never drawn; `rrlite2/3 -> rrlite4`   | `0x004104c0`, `0x00410750`, `RACEC3R0\TEST.MAB`                                                              |
| MAB flipbook                     | dfd, ama, frk, mmm (`MGMMN.MAB`), dad (`BLOWUP.MAB`)                                                                                                             | track `TEST.MAB` entries; sprite flames               | same                                                                                                         |
| UV scroll, stuck                 | tit `titwater` (`u` 1.4136), rkr `rktrans` (`v` 0.1640), psp `pswater`, igp `iawater` falls, ama `aaawatr` falls, dfd `dffall`, aar `araenrgy`, mmm/att `mmlava` | port UV constant or far from the original over frames | `Instance_ApplyVelocity` `0x10027f40` scroll shorts `+0x60`, `+0x62` (hypothesis)                            |
| UV scroll, off by a frame or two | flames `burn2`/`burn4` (`DT*FLA*`), fans `sbfan` (`SHEOUT*`)                                                                                                     | `v` differs by 0.001 to 0.005                         | **Fixed** ([effects-sweep.md](effects-sweep.md) 2): the figures scroll by the milliseconds they were stepped |
| Vertex colour                    | sky `/skymat` (all races), `rrtrack` red/blue tint, `pswater` (small), `GMCM`                                                                                    | diffuse differs across frames                         | `0x0041ccb0` (sky keyframes); the rr tint unlocated                                                          |
| Skeleton/instance animation      | rr `planet`                                                                                                                                                      | UV and colour mismatch above                          | `0x10023b10`                                                                                                 |

## Task list (one fix each)

1. ~~World sprites~~ (item 4): done, see [world-sprite.md](world-sprite.md).
2. Apply MAB rows to the scene materials (item 6); fixes the last race's wall lights and the sprite flame flipbooks.
3. Apply instance UV scroll to the track materials and check the clock phase (item 3).
4. Sky: material texture, depth, colour keyframes (item 1); first separate the sky from the cars in the sweep.
5. Race start fade-in quad `0x00433525` (item 5), then the finish fades.
6. ~~Far track surface: level choice and draw distance (items 2, 9)~~: done, see "What is drawn when".
7. Planet of the last race (item 7).
8. Particles: `csmoke`, `watmist4`, welders, power-up trails (item 8).
9. Sweep: compare computer cars' poses (golden trace) so that cars stop dominating the unmatched list.

## What is drawn when (draw distance, level of detail, culling, fog)

The class sweep over all 26 races, by mechanism. Evidence is `cov-visibility-v1` and `v2` (the numbers under Totals); the cases that hold the fixes are in `visibility.trace.spec.ts`.

| Mechanism       | Original (address)                                                                                                                                                                                                                                                               | Port before                                                                                    | Port now                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Clip volume     | Out-codes of the transform `0x1000c630`: x, y, w - x, w - y from the signs, z < 0 and z > w; the race camera has near 5, far 800 (render-trace.md finding 6); the farthest corner drawn is 800.000                                                                               | Camera near 0.5, far 20,000: triangles past 800 were drawn whole                               | `ORIGINAL_NEAR_PLANE` and `ORIGINAL_FAR_PLANE` in the race camera |
| Instance level  | `0x10027d80` (mesh and BSP instances) and `0x100240b0` (skeleton instances): the first of three squared distances not below the squared distance from the instance position (mesh) or from the sphere centre (skeleton); none past the last, and none on a level without a model | Only instances the race tracked or with several levels; a single finite level was always drawn | Every non-background instance (`scene-object`)                    |
| Instance sphere | The same functions then test the sphere against the six planes (`0x1002bc20`); the sphere is the level 0 mesh's bounding sphere (`0x100278c0`, `getModelBounds`) carried by the instance frame (`0x10027ea0`), or for a playing clip the clip's sphere (`0x10023ef0`)            | Only the clip spheres of animated skeleton instances                                           | Every instance; `SceneMesh.boundingSphere`                        |
| BSP leaves      | `0x100092a0`, `0x1001b640`, `0x1002bc90` (bsp-tree.md)                                                                                                                                                                                                                           | Ported                                                                                         | Unchanged                                                         |
| Racers' parts   | `0x0040e270`: level distance 500 and a sphere test                                                                                                                                                                                                                               | Ported (render-trace.md finding 6b)                                                            | Unchanged                                                         |
| Sprites         | `0x10029fa0` distance limit                                                                                                                                                                                                                                                      | Ported                                                                                         | Unchanged                                                         |
| Fog             | None: no frame of the sweep sets render state 28 (fog enable) or any fog state; the recorder logs every `SetRenderState`                                                                                                                                                         | None                                                                                           | None                                                              |
| Cut pieces      | The driver emits the polygon left after the cut as new triangles                                                                                                                                                                                                                 | n/a (measurement)                                                                              | Sweep matches a piece to its whole triangle                       |

Open, outside this task (noted, not fixed): the introduction and countdown camera (frames 5 and 100, a camera difference); the dome (its root has no whole triangle, so the comparison cannot pick its matrix and the 36 port triangles read as extras against 16 cut original ones, 5,916 of the unmatched); the last race's planet (`planet` 1,785 unmatched, placement of the backdrop and its scroll, item 7); the computer cars' poses (14,709 original-only and 170,347 port-only, simulation); moving track parts of `ama` and `att2` (the Amazon's `titrock`, `aaawatr`, `atwall1`: positions of animated instances); water and lava surfaces (`pswater`, `mmlava`, `iawater`: UV scroll, item 3).

Everything above is from one run (26 races, 17 to 51 frames each); names of causes marked hypothesis are not traced to an address.
