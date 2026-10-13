# Destructible barriers: surface signals and barrier hazards

Source: `LEGORacers.exe` (English, 1999-07-22), decompiled with `reverse-engineering/ghidra-query.sh`. Ports: `projectiles` (`createTrackLineProbe`), `race` (`surface-materials`, `race-world`, `update-race`), `track-logic` (`updateTrackLogicFrame`, the session's probe), `hazard` (`gate`, `sphinx`, `pillar`, `rock`, already there). Anything not proven is marked **hypothesis**.

## What the barrels are

The shortcut barrier of the first pirate track (`RACEC0R1`) is **not** a hazard object with a shape and not a world instance that a registry entry hits. It is a set of triangles of the track's collision volume (`IGCOLLID.BVB`, two triangles, a 36 by 19 unit wall around `(-402, 508, 100)`) whose collision material is named `shootme`. The race gives every BVB material the track-material entry (`.TMB`, [track-material.md](track-material.md)) of the same name as its property (`+0x14`, `0x00435d20`). The entry says what touching the material does:

| Entry field        | `RACEC0R1.TMB` `shootme` | Meaning                                                         |
| ------------------ | ------------------------ | --------------------------------------------------------------- |
| `+0x08` bit `0x10` | set (flags `0x11`)       | the material carries a signal (keyword `0x2b`)                  |
| `+0x18`            | 7                        | the signal                                                      |
| bit `0x10000`      | clear                    | cars hit it as a wall (`0x0042a830` returns `~flags >> 16 & 1`) |
| bit `0x20000`      | clear                    | projectiles hit it (`0x0041f730`)                               |

The barrels' meshes are four skeleton instances of the track world (`block`, `barrel`, `barrel01`, `barrel02`, each with a clip of the same name in `TEST.WDB`), driven by the barrier hazard.

## How a shot reaches them (`World_GetSolidLineHit`, `0x0041f730`)

`0x0041f730(world, start, end, plane, hitPoint)` is the line probe every flying thing uses: the ballistic body's advance `0x00431550` (cannon ball, barrel, a hazard's cannon), the wand beam `0x00455100`, the rocket `0x00423640` / `0x00423a20`, the latched grapple hook `0x00444820`. It runs the world's line query `0x0041f4d0` (the dynamic sphere objects at world `+0xa8`, then the track object's BVB) and, for a hit with a material property:

1. flag `0x10` (`+8`): `Events_StartSignal(+0x18, hitPoint)` (`0x00461ef0`) **then** `Events_StopSignal(+0x18, hitPoint)` (`0x00462140`), at once and every time the line meets the material;
2. flag `0x20000`: the probe returns 0 (a miss; the signal came first).

Anything else is a hit (the projectile ends there; the cannon's ground burst needs the hit normal's z above `0.7071`). The magnet's placement (`0x00456360`), the bricks' drop (`0x00453840`) and the hazards' ground queries call `0x0041f4d0` directly: no signal, no pass-through.

The collision registry's hit listeners (`0x00431660`, `0x00456320`, `0x00421c00`) only act on **racers** (a flight touches a racer, a hazard-effect touches a racer, an explosion blasts a racer); none of them can reach the barrier, which is why the explosion of a cannon ball that lands next to it does nothing. Registry contact type 2 (`0x0042fd10`, two non-racer shapes overlapping) is only consumed by main triggers registered with keyword `0x2c` (`Fire` `0x00463c70`, `0x0045b9a0`); **no trigger file of the 28 uses `0x2c`** (checked), so it is unreachable in the shipped data (still not ported).

## What destroying them does (`Hazard34`, `0x0048ed10`, vtable `0x004b4654`)

`HAZARDS.HZB` of `RACEC0R1` has a `0x34` hazard: identifier 7, collision object `shootme`, parts `block`, `barrel`, `barrel01`, `barrel02`. Its loader `0x0048ee00` finds the track-material entry `shootme` by name (hash `0x004119a0`, race `+0x27e0`) and the four skeleton instances, and stops their animation.

- **Begin** (`0x0048ef70`, when signal 7 starts and the hazard is idle): each part's level distances are zeroed and its flags get animated (`0x10000`) and not looping (`& ~0x40000`), so the clip plays once from where it stopped; `StartStopSignal(9, 9)` tells the events; lifecycle active.
- **Update** (`0x0048f030`, every frame while not idle): sets flags `0x10000` and `0x20000` of the `shootme` entry (**cars and projectiles now pass**), and ends when part 0's clip has finished (`0x0040e360`).
- **End** (`0x0048efe0`): when every part has finished, they stop animating and the hazard is idle.
- **Draw** (`0x0048f080`, slot `+0x1c`, every frame from `0x00435a00`): while the hazard is not idle each part is drawn with the first part's saved distances and the alpha `ftol((frames - time) / frames * 255)`, so the barrels fly apart and fade out; the zeroed distances only keep the world's own drawing from them ([play-test-visuals.md](play-test-visuals.md)). The entry's flags are **never restored**: the barrier stays open for the rest of the race (no respawn). The `0x10` signal flag stays too, so a later shot through the gap starts the hazard again and replays the clip.

Other effects of signal 7 come from the event set (not from the hazard): event `2A` with identifier 7 plays the sound at `(-404.9, 520.9, 60.1)`; events listening to 9 (the gate opening) do the rest. There is no debris object; the barrels are the animated parts, drawn by the hazard itself while they break.

The same flags are toggled by the other collision-object hazards (all four set or clear `0x10000` and `0x20000` of a named entry): pillar `0x28` (`0x0048ba20` clears them when it lands), sphinx `0x29` (its Begin `0x0048c180` sets them), rock `0x2e` (`0x0048e5a0` sets, `0x0048e600` clears).

## Which races have signal materials

Entries with flag `0x10` in the 14 `.TMB` files, with the BVB triangles that carry the material:

| Folder (races)                     | Entry (flags, signal)                            | Effect                                                                                                |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `RACEC0R1` (c0, c3)                | `shootme` (`0x11`, 7)                            | the barrel barrier above (hazard `0x34`)                                                              |
| `RACEC2R3` (c2, c5)                | `doorcol` (`0x11`, 2)                            | a door in `ARACOL.BVB` opened by the same `0x34` hazard (parts `door`)                                |
| `RACEC0R2` (c0, c3)                | `sphinx` (`0x11`, 12), `pmiddoor` (`0x30011`, 1) | the sphinx hazard `0x29` (identifier 12) removes the sphinx collision; `pmiddoor` already passes cars |
| `RACEC0R3` (c0, c3)                | `mmcolas1`..`6` (`0x19`, 70..75)                 | events (the signal flag with the hull-event flag `0x8`)                                               |
| `RACEC3R0` (the final race, twice) | `shootme` (`0x10011`, 1)                         | cars pass; a shot starts signal 1                                                                     |
| `RACEC2R0` (c2, c5)                | `crock` (`0x11`, 5)                              | no triangle with that material in the race's BVBs (hypothesis: unused)                                |

So 12 of the 25 races have at least one such material; the shootable barrier that blocks a route is the pirate one (and the space door, the sphinx wall).

## Port

`getProbeSurface` (`race`) reads an entry: pass-through is flag `0x20000`, the signal is `+0x18` when flag `0x10` is set; `createTrackLineProbe` calls the signal handler before dropping a pass-through hit. The race binds the handler where the probe is made: `update-race` collects the signals of the power-ups' update and hands them to `updateTrackLogicFrame`, which starts and stops each **after the worlds' animation and before the triggers** (the original animates the worlds first; a barrier opened this frame must not advance its clip until the next one, checked against the original); the hazards' own probe (`0x0041f730` from a cannon hazard) starts and stops its signals inside the track session. `hazard.collision_object_changed` is applied to the race's `surfaces` (`getSurfacesWithBarrierOpen`), so the car body's contact filter (`0x0042a830`) and the next probes see the open barrier. The previous port passed no pass-through at all to the probes (`() => false`), so `go_thru` surfaces stopped projectiles; they now let them through.

## Verified

`projectile-barrier.golden.spec.ts` (`pnpm run golden-trace`): on `RACEC0R1` the closed-loop driven player (route driving) is granted a projectile three frames before it presses the use key at frame 1460 (cannon ball, level 0) and at 1440 (wand, level 2). The original opens the barrier at frame 1477 (cannon ball) and 1460 (wand); the port matches **every compared field** in both, including the new `track.surfaces` (the flags of every track-material entry), the hazard lifecycle, the events and the skeleton clips of the barrels, except `powerUps.registry` from frame 436 (the known `racec0r1` divergence of [golden-trace.md](golden-trace.md), unrelated). Before this change nothing in the port started the signal, so the barrier never opened.

`track.surfaces` also matches the original over the 1,500-frame demonstration races of `track-logic.golden.spec.ts` (computers only, so the hazards open and close the pillar, sphinx and door materials of their own accord) in every race but `RACEC0R3`, where it differs at frame 797 together with the already known event `2A` divergence (the original opens `mmrocc`; **hypothesis**: the rock hazard's touch, which no race delivers).

**Not verified against the original**: a car driving through the opened gap (the barrier is open to the car body's contact filter in the unit specs, `surface-materials.spec.ts`; the golden driver does not take the shortcut), the sphinx and door races, and the hazard cannon's probe path.
