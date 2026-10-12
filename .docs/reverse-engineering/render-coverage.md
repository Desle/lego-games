# Render coverage: is everything the original draws drawn by the port?

[render-trace.md](render-trace.md) and [pixel-trace.md](pixel-trace.md) check a few scenarios in depth. This sweep checks **breadth**: every race of `LEGORACE.RCB` (26 entries: 12 forward, 12 mirrored second passes, the final race and its mirror; `test` has no circuit), a whole first lap each, and a list of what the original draws that the port has no partner for (and the reverse). It reports; it fixes nothing. Each item below is meant to become one small fix task.

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
- **Untrusted frames.** A frame where less than 60 percent of the original's triangles match means the port's race has left the original's (simulation divergence of the computer racers, see [golden-trace-computers.md](golden-trace-computers.md)); it is listed but not tallied. `psp`/`psp2` lose 39 of 51 frames, `ipp` 19, `ipp2` 13, `aar` and `att2` 10 each; the rest at most 2.
- **What the numbers are not.** `Pixels` is the sum of the unmatched triangles' areas over the sampled frames (overlaps counted twice), a ranking weight, not coverage. A texture the matcher cannot name is `unknown <hash>`. Texture names are the port's best look-alike: near duplicates (`rrlite2`/`rrlite4`) can swap.

## Races

| Race | Folder   | Mirrored | Lap end frame | Finish frame | Recorded | Untrusted | Mean share matched | Lowest |
| ---- | -------- | -------- | ------------: | -----------: | -------: | --------: | -----------------: | -----: |
| igp  | RACEC0R1 | false    |          1430 |         3827 |       20 |         0 |              0.959 |  0.921 |
| dfd  | RACEC1R0 | false    |          1505 |         4217 |       20 |         0 |              0.967 |  0.874 |
| mmm  | RACEC0R3 | false    |          1237 |         3413 |       17 |         0 |              0.953 |  0.745 |
| dad  | RACEC0R2 | false    |          1404 |         3733 |       19 |         0 |              0.955 |  0.875 |
| tit  | RACEC1R1 | false    |          2543 |         3919 |       32 |         0 |              0.960 |  0.904 |
| rkr  | RACEC0R0 | false    |          2330 |         3476 |       30 |         0 |              0.950 |  0.861 |
| ipp  | RACEC1R3 | false    |          2774 |         3938 |       35 |        19 |              0.920 |  0.672 |
| ama  | RACEC1R2 | false    |          3035 |         4025 |       37 |         0 |              0.927 |  0.681 |
| frk  | RACEC2R0 | false    |          3651 |         4030 |       44 |         0 |              0.929 |  0.829 |
| psp  | RACEC2R1 | false    |          null |         4269 |       51 |        39 |              0.833 |  0.603 |
| att  | RACEC2R2 | false    |          3682 |         5318 |       45 |         0 |              0.894 |  0.604 |
| aar  | RACEC2R3 | false    |          3228 |         3613 |       40 |        10 |              0.898 |  0.624 |
| igp2 | RACEC0R1 | true     |          1501 |         3806 |       20 |         0 |              0.924 |  0.686 |
| dfd2 | RACEC1R0 | true     |          1679 |         4275 |       22 |         1 |              0.960 |  0.886 |
| mmm2 | RACEC0R3 | true     |          1375 |         3436 |       19 |         1 |              0.971 |  0.882 |
| dad2 | RACEC0R2 | true     |          1521 |         3772 |       21 |         0 |              0.913 |  0.673 |
| tit2 | RACEC1R1 | true     |          2543 |         3919 |       32 |         0 |              0.951 |  0.869 |
| rkr2 | RACEC0R0 | true     |          2337 |         3486 |       30 |         0 |              0.931 |  0.615 |
| ipp2 | RACEC1R3 | true     |          2872 |         3905 |       36 |        13 |              0.784 |  0.601 |
| ama2 | RACEC1R2 | true     |          3031 |         4023 |       37 |         0 |              0.946 |  0.752 |
| frk2 | RACEC2R0 | true     |          null |         3987 |       48 |         1 |              0.908 |  0.673 |
| psp2 | RACEC2R1 | true     |          null |         4278 |       51 |        39 |              0.853 |  0.623 |
| att2 | RACEC2R2 | true     |          3916 |         4717 |       47 |        10 |              0.862 |  0.657 |
| aar2 | RACEC2R3 | true     |          2645 |         3652 |       33 |         0 |              0.925 |  0.778 |
| rr   | RACEC3R0 | false    |          1877 |         3424 |       25 |         0 |              0.908 |  0.708 |
| rr2  | RACEC3R0 | true     |          1895 |         3496 |       25 |         2 |              0.916 |  0.737 |

`null` lap end: racer 0 does not count a lap before the first finish in the port's probe (hypothesis: the port's route follower and the start-line zone disagree on `psp`, `frk2`; the sweep then ends at the finish). The finish frames are the first racer of the field finishing (about 3,400 to 5,300 frames, 2 to 3 minutes of play).

## Totals by cause (all 26 races, trusted frames)

| Cause                                                      | Unmatched triangles | Pixels (sum) | Frames x textures | Races |
| ---------------------------------------------------------- | ------------------: | -----------: | ----------------: | ----: |
| Triangles of textures the port draws elsewhere (item 2, 3) |             108,400 |      136.8 M |             8,347 |    26 |
| Vertex-coloured geometry: sky dome and car bodies (item 1) |              16,217 |       85.6 M |             1,589 |    26 |
| Screen overlays (race start fade, minimap, item 5)         |               1,290 |       16.4 M |               645 |    26 |
| World sprites (item 4)                                     |               1,327 |       1.19 M |               222 |    18 |
| Final race wall lights (item 6)                            |               1,031 |       0.79 M |                70 |     2 |
| Other textures the port never draws                        |                 663 |       0.25 M |                55 |    23 |
| Emitter particles and trails (item 8)                      |                 313 |       0.12 M |                18 |    11 |

Of the original's 718,421 triangles in the trusted frames, 129,241 (18 percent) have no partner; most are item 2 and the cars.

## Ranked list

Ranked by visibility (pixels x frames), in groups with one likely cause; "never drawn" means no port object uses the texture in any race.

### 1. Sky dome: textured and depth-tested in the original, untextured and unbuffered in the port

- Evidence: the original's vertex-coloured, stale-texture draws (`unknown eea37d3f06eea066 256x256`, state `opaque/select_diffuse`: 8,755 of 16,856 triangles unmatched, 58 M px) and the `skid` label (the sky texture and shadows match `skid` best, [decal.md](decal.md)): `skid` opaque/select_diffuse 5,023 of 8,224 and `skid` blend/modulate 2,402 of 4,052 unmatched, about 130 to 260 triangles in nearly every frame. The port's `/skymat` object is the extra (3,310 triangles in 175 frames) and the mismatch table says why: texture `ac389648b9db3c0c -> none` (967 triangles in 172 frames), UVs `(0.75, 0.5) -> (0, 0)`, `colorOperation modulate -> select_diffuse`, depth test and write `true -> false`, diffuse `243,243,243 -> 0,0,0` (sampled frames; the sky also animates through keyframes, `0x0041ccb0`).
- Likely cause: the dome's material `skymat` loses its texture in the viewer (`sky-object`), is drawn without depth, and its colour keyframes (`Sky_Update` `0x0041ccb0`, ported as `advanceSky`/`getSkyVertexColors`) are not what the original draws at those times. pixel-trace.md already lists the sky's brightness as open.
- Candidates: `0x004907f0` (dome builder, ring colours), `0x0041ccb0`, `0x0041c550` (Sky_Load assigns the material); port `sky` module and `services/sky-object`.
- Part of this row is the computer cars' vertex-coloured bodies (`BKCM/all`, `KKCM/all`, `GMCM/black` ...: 16,854 + 7,286 + 6,949 + ... port triangles without partner, and the same models unmatched on the original side): both draw them, at poses that differ, so it is **measurement of computer-car divergence** (see Totals), not a missing draw. A fix task should first split sky from cars (draw order: the sky is drawn first, depth 100).

### 2. Far track surface: triangles the original draws and the port has no partner for (draw distance and level of detail)

- Evidence: `titroad` 2,009 of 6,199, `titrock` 3,949 of 13,289, `rkroad4` 1,255 of 3,760, `atwall1` 2,514 of 8,037, `ip_ice` 1,823 of 7,259, `aaadrtrd` 1,018 of 2,760 ..., 30 to 40 percent of a textured surface's triangles, depth 8 to 800, every race. The textures are drawn by port objects (`rktk/rkroad` ...), so only some triangles lack partners.
- Likely cause: known in render-trace.md ("draw distance of the track"). The original draws per instance level by distance (world instance levels, `0x10023940`, level distance fields) and clips by the frustum test `0x0040e270`; the port draws a different set in the far field. The port also draws far props the original does not (item 9). One fix task: compare the level choice of the instance draw (`Renderer_DrawInstance` `0x10008910`) against the viewer's level selection and draw distance.

### 3. Truncated walls: textured surfaces drawn with another texture, UV or colour

- Evidence (mismatch table, texture/UV/colour kinds on shared triangles): `water01/titwater` (tit, tit2) 1,677 triangles with UV `(1.9393, 0.3319) -> (1.4136, 0.3319)`: the port's `u` stays at 1.4136 while the original's runs on; `pswater/pswater` (psp) 839; `rkwater2/rktrans` (rkr) 185 (`v` stuck at 0.1640); `fallls/iawater` (igp) 120; `wtrfall/aaawatr`, `pool/aaawatr3`, `amazon/aaaamzon` (ama) 203 + 110 + 464; `falls/dffall` (dfd) 189; `energy1/2 araenrgy` (aar) 250; `mmlava/mmlava`, `lava01/02` (mmm, att) 381 + 133; `warpent/warpent` and `arrow1/4 rrcurb` (rr) 186 + 285; `DT0FLA1/2 burn2` flames 1,520 (small phase shifts, 0.003 in `v`: the port's scroll runs a frame or two off); `SHEOUT0..2/sbfan` 1,800 (the fan UVs drift). See the animated-material table below.
- Cause (fixed, see [texture-scroll.md](texture-scroll.md)): the instance texture scroll of `Instance_ApplyVelocity` `0x10027f40` was not ported. Measured on frames 250 and 340 of the demonstration: `titwater` 85, `rktrans` 29, `aaaamzon` 45, `pswater` 79 triangles differed in `u`/`v`; with the scroll 0, 0, 0 and 3 (`uv-scroll.trace.spec.ts`). Open: flames (`burn2`) and fans (`sbfan`) are not driven by this scroll in the data (no keyword `0x3f` or scroller on them); their phase is still to trace.

### 4. World sprites (`0x37`) are never drawn

- Evidence: the `World` sprite list (`0x1002d950`: count `+0x6c`, 0x38-byte records at `+0x70`) is parsed (`world` module, `Sprite`) and their material animations started by the sim, but no viewer code builds them. The original draws them: `rndtree` (royal knights sprite `rktree`, 8 sprites; 202 triangles in rkr/rkr2, 272,000 px), `adtorch` (dad 54, frk 15 torches; 313 triangles, 234,000 px), `aranbula`, `araastrd`, `ararobot` (aar/aar2: 13 sprites, 330 triangles, about 480,000 px), `aaaspidr` (ama, 3), `skullhd`/`skullhd2` (frk, 3 + 7), `bushtree` and `atsklpst` (att: `bshtre` 3 + `mate2205` 16), `radar` (mmm: `mmradish`), `mmplanet`, `mmplane2`, `dfmoon` (dfd, 1), `ip_lmp`, `ip_llt02` (ipp: 3 + 4), `ktcbl` (frk). Each of these has `portSources` empty in every race. Sprite counts per world come from the `.WDB` lists (RACEC0R0 `RRTRK.WDB` 8, RACEC0R2 54, RACEC0R3 4, RACEC1R0 1, RACEC1R2 3, RACEC1R3 7, RACEC2R0 26, RACEC2R2 19, RACEC2R3 13; none in RACEC0R1, 1R1, 2R1, 3R0).
- Candidates: loader `0x1002d950`; keywords `0x39` material name, `0x31` position, `0x38` vector (flag 2), `0x3a`/`0x3b`/`0x3c` floats (size and distance, default `FLT_MAX`), `0x2b`, `0x3e` (material animation link, `0x1002e250` `World_LinkSpriteMaterialAnimation`, `0x10017ac0`); sprite attachment to a camera `0x004047b0` (not ported). **The draw function is not located yet** (task: find the reader of world `+0x6c`/`+0x70` in the world draw and record the billboard rule: size, facing, distance cut). The sprite material animation (flame flipbooks of `adtorch`) then comes from item 6's mechanism.
- Size: medium (a billboard mesh per sprite in the viewer's scene builder, plus the facing rule).

### 5. Screen overlays outside the world comparison

- **Race start fade-in** (all 20 races whose frame 5 is trusted; 40 triangles, 6.1 M px): a full-screen `blend/select_diffuse` quad at frame 5 (depth 1.0). It is the screen fader entry `0x00433525` (500 ms fade-in at race start); pixel-trace.md says "Not wired yet". The finish fades (`0x00434ee8`, `0x004351ab`) were not seen at finish +5 and +60 (the fade is later); a longer finish capture would show them.
- **Minimap** (`128x128` blend quad at 497,337-625,465, depth 1.0, one new texture per race: `unknown 58f7dfb50eb30ee5` in rkr, `52a6ec68e660cf8e` aar ...): HUD `0x004249b0`; the port's HUD draws a minimap (`race-hud`, compared by the HUD comparison of render-trace.md), not by the world list; the texture is built at race load, so it is "unknown" here. Not a gap.

### 6. Material flipbook animation (MAB) is not applied to the track: the last race's wall lights

- **Answer: yes, the last race has wall lights the port misses.** `RACEC3R0` `TEST.MAB` has 8 materials and 2 entries (`keyword27Values` `[0,4]` and `[4,4]`, length 8, rate 0.03 per ms): a flipbook cycling the light materials. The original draws eight textures, `rrlite1` to `rrlite8`, on the wall light faces (rr: `rrlite7` 317 triangles, `rrlite2` 391, `rrlite3` 354, `rrlite6` 280, `rrlite8` 113, `rrlite4` 179, `rrlite5` 61, `rrlite1` 52; plus the `select_diffuse` variants). The port has port objects for `rrlite4` and `rrlite8` only (`rrtrack/rrlite4`, `rrtrack/rrlite8`); `rrlite1`, `2`, `3`, `5`, `6`, `7` have `portSources` empty. Unmatched: `rrlite7` 92 of 317, `rrlite6` 186 of 280, `rrlite3` 96 of 354, `rrlite2` 55 of 391, `rrlite5` 45 of 61, `rrlite1` 39 of 52 (plus 25 to 56 percent of the `select_diffuse` lines); mismatch `texture rrlite2 -> rrlite4` and `rrlite3 -> rrlite4` on `rrtrack/rrlite4` (644 triangles in 23 frames). The wall also flashes red and blue in the original (`rrcwndow`, `rrcelng`, `rrpanel3`, `rrroad` diffuse flips between `35,35,255` and `255,35,35`: colour mismatches in both directions on the same triangles); **hypothesis**: the lights are one material per bulb whose texture index is rewritten by the animation, the wall's tint comes from a second effect (vertex colours); the sweep cannot tell the order.
- Likely cause: the sim carries each world's `MaterialAnimationRuntime` with the chosen table row (`MaterialAnimationPlayback.tableIndex`, `getAdvancedMaterialPlayback`, `0x004104c0`); in the exe the row is written to the world's material value table (`0x00410750`: `[world + 8][materialIndex] = row value`) which the draw (`Renderer_ApplyMaterial` `0x1000a2c0`) uses to pick the material's texture. Only the emitter system reads the row (`emitter-system.ts`); the viewer never maps it onto the scene's materials.
- Same mechanism, other tracks (their `TEST.MAB`): RACEC1R0 (17 materials), RACEC1R2 (2), RACEC2R0 (about 140), RACEC0R3 `MGMMN.MAB` (18), RACEC0R2 `BLOWUP.MAB` (11, the sphinx) and the sprites' flame flipbooks (`adtorch`).
- Size: medium (apply the row to the scene material's texture each frame; the textures of the chain are loaded).

### 7. The last race's planet: another texture, UV, colour and depth state

- `planet/planet` (rr, rr2): the original's planet triangles (1,054 of 1,442 `planet` modulate unmatched) pair with port triangles of another texture (`texture pupgree2/pupred2 -> planet`), UVs `(0, 0.75) -> (1.8486, 1.3789)` (1,430 triangles), diffuse `243,243,243 -> 41,151,187`, depth `true -> false`; the port also draws 4,046 `planet/planet` triangles the original does not pair. A skeleton or UV animation of the planet (rotation) is not advanced like the original, or the dome is drawn at the wrong depth state (hypothesis). Candidates: `0x10027f40` (instance UV scroll), `0x10023b10` (skeleton instance step); see item 3.

### 8. Emitter particles and trails (rare frames, computers' power-ups)

- Never drawn by the port: `csmoke` (att, att2: 72 triangles), `watmist4` (ama: 12), `mslstrk` additive (aar2, rr, rr2: 180 triangles, additive missile streak), `canstrk` (frk, igp, rr: 39), `litflash` additive (att2: lightning flash), `welder`, `welder2` (mmm: 4). They appear in a handful of frames each, when a computer uses a power-up or an emitter fires. Overlaps the three bugs under repair (capture ship, debris, sparkles) for the power-up ones; `csmoke`, `watmist4` and the welder belong to the track's `EMIT*.EMB` pools (`hazards-and-emitters.md`) and are separate tasks.

### 9. Port objects the original does not draw

- Props: `ship/plainmat` 5,212 triangles and `ship01` 4,762 (psp, ipp, igp), `longship`/`longsh01` 3,160 (ipp), `mosscot1`/`mosscout` 5,300 (aar), `prntdum` 2,450 (frk), `aa_plane` 1,681 (ama), `arktp` 1,492 (att), `palm00/26` (palm trees) 3,100 (dad, psp), `forbid/rr_caswl` 2,158 (psp), `mmlava` 2,173 (mmm), `pswater` 7,444 (psp). All vertex-coloured or texture-less props drawn in frames where the original does not: draw distance / instance level or an instance flag that hides them in the original (hypothesis; same family as item 2).
- Cars: see item 1.
- State: port enables the alpha test where the original does not (`isAlphaTestEnabled false -> true`): car parts (`KKJMW` 11,515 triangles ...), `rktk/rktowtop`, `rktk/rkfence`, `ENHABRIK/pubrickw`, `PUBRICKY/*`, shadows `/carshad0` (1,215). The viewer's alpha test stands in for the colour key ([render-trace.md](render-trace.md)); not a visible gap.

### 10. Measurement limits (do not become tasks)

- Computer cars diverge from the original after about frame 211 (power-ups) and on `psp`, `ipp`, `aar`, `att2` earlier; the sweep counts those frames untrusted. Cars' vertex-coloured bodies are the largest "missing" and "extra" entries because their poses differ.
- The matcher names the original's stale-texture vertex-colour draws `eea37d3f06eea066` and the sky `skid`.

## Animated materials the port leaves static or off-phase

| Animation                        | Where                                                                                                                                                            | Evidence in the sweep                                 | Mechanism / candidate                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| MAB flipbook (texture index)     | rr, rr2 wall lights `rrlite1..8`                                                                                                                                 | 6 of 8 textures never drawn; `rrlite2/3 -> rrlite4`   | `0x004104c0`, `0x00410750`, `RACEC3R0\TEST.MAB`                                   |
| MAB flipbook                     | dfd, ama, frk, mmm (`MGMMN.MAB`), dad (`BLOWUP.MAB`)                                                                                                             | track `TEST.MAB` entries; sprite flames               | same                                                                              |
| UV scroll, stuck                 | tit `titwater` (`u` 1.4136), rkr `rktrans` (`v` 0.1640), psp `pswater`, igp `iawater` falls, ama `aaawatr` falls, dfd `dffall`, aar `araenrgy`, mmm/att `mmlava` | port UV constant or far from the original over frames | `Instance_ApplyVelocity` `0x10027f40` scroll shorts `+0x60`, `+0x62` (hypothesis) |
| UV scroll, off by a frame or two | flames `burn2`/`burn4` (`DT*FLA*`), fans `sbfan` (`SHEOUT*`)                                                                                                     | `v` differs by 0.001 to 0.005                         | clock phase, as the turbo texture scroll in power-up-visuals.md                   |
| Vertex colour                    | sky `/skymat` (all races), `rrtrack` red/blue tint, `pswater` (small), `GMCM`                                                                                    | diffuse differs across frames                         | `0x0041ccb0` (sky keyframes); the rr tint unlocated                               |
| Skeleton/instance animation      | rr `planet`                                                                                                                                                      | UV and colour mismatch above                          | `0x10023b10`                                                                      |

## Task list (one fix each)

1. World sprites: build billboards; find the draw rule (item 4). Medium; largest absent set of props (18 races).
2. Apply MAB rows to the scene materials (item 6); fixes the last race's wall lights and the sprite flame flipbooks.
3. Apply instance UV scroll to the track materials and check the clock phase (item 3).
4. Sky: material texture, depth, colour keyframes (item 1); first separate the sky from the cars in the sweep.
5. Race start fade-in quad `0x00433525` (item 5), then the finish fades.
6. Far track surface: level choice and draw distance (items 2, 9).
7. Planet of the last race (item 7).
8. Particles: `csmoke`, `watmist4`, welders, power-up trails (item 8).
9. Sweep: compare computer cars' poses (golden trace) so that cars stop dominating the unmatched list.

Everything above is from one run (26 races, 17 to 51 frames each); names of causes marked hypothesis are not traced to an address.
