# Racer set-up: who races, and with which car

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/racer-setup`, wired by `race`'s `loadRaceDefinition`. Data pages: [driver-database.md](driver-database.md), [champion-database.md](champion-database.md), [chassis-database.md](chassis-database.md), [circuit-database.md](circuit-database.md), [race-catalog.md](race-catalog.md).

## The chain

1. **Front end** `FUN_0042d730` fills the game settings block (`+0x100` racer count, then `0x5c`-byte racer slots from `+0x104`, kind at `+0x114`). With the circuit of the race (RCB entry → CRB circuit) the count becomes the smaller of 6 and the circuit's code count, and slot `i` gets circuit code `i` (kind 2, computer). Then each **local player** `p` overwrites slot `p` through `FUN_0042dcb0`: name byte 0 = 0 (an empty name marks a car built from bricks), chassis name at `+0x08`, weight at `+0x14`, centre offsets at `+0x18`, `+0x1c`. With no local player every slot keeps its circuit code.
2. **`Race_LoadTrackContent`** builds two blocks for `RacerSet_Setup` (`0x0043b190`): the racers (count, name pointers, routes, `+0x3c` = game settings `+0x20`) and the world (Gol root, collision objects `+0x3b0` and `+0x3b8`, …). `RacerSet_Setup` loads the three databases from `GAMEDATA\COMMON` (`0x0042c4e0` sets the directory) and calls `RacerSet_SetupRacer` (`0x0043b480`) per racer.
3. **`0x0043b480`** builds a 0x90-byte _description_ on its stack, then calls `Racer_Setup` (`0x00436df0`), which calls the vehicle set-up (`0x0043d7a0`), `Racer_AttachCarBody` (`0x004371c0`) and `Racer_ResetForRace` (`0x004374c0`).

## Description fields (`0x0043b480`)

| Offset           | Champion racer (name set)                           | Car built from bricks (name empty)                                                         | Used for                                                           |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `+0x18`          | display name: `StringTable_GetString(driver +0x00)` | 0                                                                                          | HUD name                                                           |
| `+0x1c..+0x4b`   | chassis `+0x88..+0xb7` (four wheel points)          | same                                                                                       | wheel anchor, track width, wheelbase                               |
| `+0x4c`          | champion `+0x24..+0x2c`                             | x `slot+0x18 · 0.25 + chassis+0xb8`, y `slot+0x1c · 0.25 + chassis+0xbc`, z `chassis+0xc0` | local centre of mass                                               |
| `+0x58`          | champion `+0x20` (mass 4,500)                       | `chassis+0xd0 + slot+0x14` (2,500 + weight)                                                | rigid body mass                                                    |
| `+0x5c`          | 0                                                   | `slot+0x14` (the weight)                                                                   | rating bonus                                                       |
| `+0x6c..+0x71`   | driver `+0x24..+0x29`                               | 100 each                                                                                   | personality → racer `+0xd1c..+0xd22`                               |
| `+0x72`          | race lap count                                      | same                                                                                       | racer `+0xce0`                                                     |
| `+0x74`          | driver `+0x2a` · 12 + `0x44c`                       | (5 · index + 50) · 20 = 1,000 + 100 · index                                                | racer `+0xd40` voice base; `+0xd23` taunt sound 0x1a..0x1f from it |
| `+0x78`          | `chassis+0xec`                                      | same                                                                                       | racer `+0xd54` (sound passes only)                                 |
| `+0x7c`, `+0x80` | driver `+0x22` (1..4, else 0), `+0x23`              | 0, 0                                                                                       | racer `+0xcd0`, `+0xcd4` preferred power-up and level              |
| `+0x84..+0x86`   | chassis `+0x100`, `+0x101`, `+0x102`                | same                                                                                       | steering, throttle, top speed ratings                              |

The slot's start position index is `racer set +0x26c + 4·i` = `i`; with two or more local players (and no ghost) racer 0 takes slot **2**; a ghost race takes `1 + (ghost +0x3b4 & 8 ? 1 : 0)`. `(**frame +0x08)` puts start position `slot` on the car model's frame and `(**frame +0x40)` its two axes.

**Resolved: `0x00429210` (`CarBody_Attach`) adds no offset.** It stores owner pointers (`+0x6f0..+0x6fc`), calls `CarRigidBody_Attach` (`0x00444d90`, which copies the frame's rotation and position into the rigid body), reads the frame position and rotation into `+0x700` and `+0x70c`, and clears `+0x738`. The car starts exactly at its slot. The earlier hypothesis is false.

**Resolved: the collision objects of every car rigid body.** `0x004371c0` passes game block `+0x0c` and `+0x10` to the attach, which stores them at rigid body `+0x140` and `+0x144` (count 2 if the second is set). They are race `+0x3b0` (`COLLIDE`'s first collision object, `firstCollisionObject`) and race `+0x3b8`, the **checkpoint object** (`RAB` keyword `0x48`, second name `checkpointObject`, looked up in the collision world by `0x00432e20`). The port gives only the first, because the hull-contact filter `0x0042a830`, which treats the checkpoint object's digit-named materials as triggers instead of walls, is not ported.

## `Racer_AttachCarBody` (`0x004371c0`) with a description

1. Collision objects as above; the attach is given the mass (`+0x58`) and the box **8 × 5 × 6.2** (`0x41000000`, `0x40a00000`, `0x40c66666`): a constant, not chassis data.
2. If racer flag `0x4000000` (game settings `+0x20` bit `0x1`) is set, car rigid body flag `0x100000`.
3. `bonus = ftol(float32(description +0x5c · 0.05))` (`0x004b0544`). Steering value = `min(chassis steering + bonus, 100)` → `CarBody_SetSteeringRating` (`0x0042ad70`): scale `+0x728 = float32(v · 0.003 + 0.7)`. Throttle value = `chassis throttle − bonus` (0 if it would go below) → `0x0042ada0`: scale `+0x72c = float32(1 − (50 − v) · 0.001)`. Top speed value = `min(top speed + bonus, 100)` → `0x0042add0`: scale `+0x730` by the same formula, then `0x00429330`: flag `0x10000` cleared, grip scale `+0x5f4` = 1, `+0x734` = 120 (`0x004b0448`), and slot 6 (`0x0042ad50`) sets **top speed = float32(scale · 120)** (`0x00448390`, drag `0x004483b0`). The old constructor default 110 is replaced.
4. `0x00441190`: centre of mass. `0x00446e60`: anchor = second wheel point, **track width = point 3 y − point 2 y**, **wheelbase = point 1 x − point 3 x** (indices from 0; stored as float32). This reproduces all four wheel points of the data.
5. `0x00446ea0` ×4: hull points `(+hx, −hy, 3.5)`, `(+hx, +hy, 3.5)`, `(−hx, −hy, 3.5)`, `(−hx, +hy, 3.5)` with `hy = chassis hull extent 0 · 0.5` and `hx = extent 1 · 0.5` (`0x004af58c`; 3.5 = `0x004b09a8`). With the data's 8 × 9: `hx` = 4.5, `hy` = 4.

The model frame's bounding radius (`frame +0x10`, used as the ground probe height) comes from `0x0040e0b0`: model bounding sphere times the frame scale, widened by the skeleton frame. **Not ported**: the port uses 5.

## `Racer_Setup` (`0x00436df0`) additions

- Racer `+0xd00` (race position) = index + 1 (was 0).
- Draws, in order: taunt timer, voice timer (racer-ai), then **`0x0043d7a0` draws a third value** (`% 2000` → vehicle `+0x388`, an animation timer). The port now makes this third draw, which the earlier code missed, so the cursor after racer set-up moves by three per racer.
- Racer flags from **game settings `+0x20`**, not from the driver: bit `0x1` → `0x4000000`, `0x2` → `0x8000000`, `0x40` → `0x1000000`, `0x80` → `0x2000000` (the `RacerPowerUpAbilities` of power-ups; the "description byte `+0xf`" in power-ups.md is this word).

## A car built from bricks

The weight of a built car is computed by the front end when it prepares the race (`FUN_0042dcb0` → `CarBuilder_GetWeightAndCentre`, `0x0049c6a0`): over the placed pieces whose id (`piece +0x14`, a `uint16`) is at least `0x800` (the builder's own bricks; the saved racer record lists them as `13 97 …`, i.e. id `0x1397`), `0x0049f560` takes the piece's footprint grid (`0x0049ea60`, orientation `& 3`; each cell holds a top and a bottom height in the low 6 bits) and returns `W`, the number of unit cells (top − bottom, bottom forced to 0 if above the top), and the sums of cell x, y and z weighted by that height. Then:

- slot `+0x14` = float(`W`), `+0x18` = Σx / W − 4.5, `+0x1c` = Σy / W − 2.5, `+0x20` = Σz / W (`0x004b4944`, `0x004b4940`).

So **the chassis type** fixes the wheels, hull, base mass 2,500 and base ratings; **the number and size of the bricks** enter only through `W`, which adds one mass unit per cell, nudges the centre of mass by a quarter of the cell centroid's offset, and moves the ratings by `ftol(W · 0.05)` points (steering and top speed up, throttle down). Brick colour and shape do not matter beyond their cells. The builder (design loading `0x0049fb30`, the brick database `LEB`, placement checks) is **not ported**: the port takes `BuiltCar { chassisName, weight, centreOffsetX, centreOffsetY }` as input, and `loadRaceDefinition` defaults to the first chassis, `dachas0`, with no weight.

## Ported

`racer-setup`: `describeChampionRacer` and `describeBuiltRacer` (`0x0043b480`), `createCarBodySetup` (`0x004371c0`), `getSteeringScale`, `getRatingScale`, `setTopSpeedRating` (`0x0042ad70`, `0x0042ada0`, `0x0042add0`, `0x00429330`, `0x0042ad50`; emulator differential tests), `getStartSlot`, `getRaceModeRacerFlags`, `getRacerPowerUpAbilities`. `race`: `loadRaceDefinition` reads the three databases from `GAMEDATA\COMMON` and the circuit's racer codes from `MENUDATA\LEGORACE.CRB/.RCB`; `createRace` takes voice base, preferred power-up, race position, race-mode flags and the third draw. Royal Knights Raceway: player = built car on `dachas0` (mass 2,500), computers `KK IL RK CC TC` with champion cars (mass 4,500, their own personalities and voices).

## Not ported

The car builder and `LEB` (weight and centre of built cars), the model bounding radius, the display name and the model/skeleton instances (`0x00420ef0`, `0x0041e360`), the vehicle set-up beyond its draw, the ghost grid slots, the checkpoint object in the collision list and its contact filter `0x0042a830`.
