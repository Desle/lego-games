# Power-ups: bricks, enhancements and effects

Source: `LEGORacers.exe` (English, 1999-07-22). Addresses are virtual addresses. Every rule below comes from decompiled code checked against the disassembly (`DisassembleRange.java`) where floats, signedness or argument order matter. Anything not proven by code is marked **hypothesis**. The port is `packages/lego-racers/src/modules/power-ups` (behaviour); the PWB file format is `power-up` ([power-up.md](power-up.md)). Names are in `reverse-engineering/names/LEGORacers.exe.txt`.

The texture and sound names in `LEGO.JAM` (`CANNON`, `GRAPPLE`, `WAND`, `ROCKET`, `OILCAN`, `BARREL`, `MAGNET`, `CURSE`, `WARPHOLE`, `DTURBO`, …) were only search leads; the classes below were found from the model names the code looks up (`"cannon"`, `"tether"`, `"lightng"`, `"dmissil"`, `"oilslck"`, `"barrel"`, `"magnet"`, `"curse"`, `"shield0"`.., `"TurboL0"`.., `"warpprt"`, `0x004b1350`–`0x004b1a80`).

## The power-up system (race `+0x6dc`)

| Offset               | Meaning                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `+0x28`, `+0x34`     | Power-up bricks (`0x68` bytes each) and their count                                                                            |
| `+0x2c`, `+0x38`     | Enhancement bricks and their count                                                                                             |
| `+0x58`              | Game settings `+0x20` (race mode flags), from `PowerUps_Initialize` `0x00457c20`                                               |
| `+0x78`..`+0xa0`     | One free list per effect class (magnet, oil, barrel, curse, cannon, grapple, wand, rocket, shield, turbo, warp)                |
| `+0xa4`              | 25 attachment objects of `0xf4` bytes (model instances an effect hangs on a racer); bitmask `+0x1878`, count `+0x187c`         |
| `+0x1880`            | The active effect list (linked through effect `+0xc`, new effects at the head)                                                 |
| `+0x1884`..`+0x188e` | Pool sizes; `+0x1890`..`+0x18b8` the pools                                                                                     |
| `+0x18bc`            | Five brick-debris objects (`"brick1"`..`"brick4"` models)                                                                      |
| `+0x193c`, `+0x1940` | Active explosions (`"Explsn"`, pool of 6) and spiked explosions (`"spikexp"`, pool of 2), class `0x004210b0`                   |
| `+0x1998`            | An external launcher set by the track hazards (`0x0048c680`, `0x0048b740`): cannon source or warp destination; null for racers |
| `+0x199c`            | Brick spin angle                                                                                                               |

Load (`Race_LoadTrackContent` `0x00433480`): `PowerUps_Initialize`, `0x00457c90` (MAB/WDB), `PowerUps_Load` `0x00458810` (PWB), `0x00457cf0` → `0x00457d30` (pools), `0x00458940` → `0x0045a340` (bricks registered with the racer set's collision registry), `0x004590f0` (pools linked; each wand makes 20 random draws, `0x004548f0` → `0x00454b90`), `0x00459b80` (explosion pools), then `0x0045b950` (brick sounds off). Race state 2 turns brick sounds on (`0x0045b900`).

Pool sizes (`0x00457d30`; the argument is race `+0x3354 == 0`, and `+0x3354` is set when two local players share the screen):

| Class     | Split screen | One screen |
| --------- | -----------: | ---------: |
| Magnet    |            2 |          3 |
| Oil slick |            3 |          4 |
| Barrel    |            2 |          3 |
| Curse     |            2 |          2 |
| Cannon    |            2 |          4 |
| Grapple   |            2 |          3 |
| Wand      |            2 |          3 |
| Rocket    |            6 |          9 |
| Shield    |            2 |          5 |
| Turbo     |            2 |          6 |
| Warp      |            2 |          3 |

`PowerUps_Update` (`0x0045a490`, once per frame with the whole time step, from `Race_Update`): bricks (`0x0045a3f0`), the spin angle (`angle = fround(dt · 0.004f + angle)`, minus `2π` when above it; `FCOM` with `TEST AH,0x41`), every active effect's vtable slot 2, explosions, debris, then every effect in state 6 is unlinked, reset (slot 7) and pushed on its free list.

## Bricks

| Brick kind | Code | Models               | Colour (hypothesis) |
| ---------- | ---: | -------------------- | ------------------- |
| Projectile |    1 | `pbrickP`, `ptrailP` | red                 |
| Shield     |    2 | `pbrickS`, `ptrailS` | blue                |
| Turbo      |    3 | `pbrickT`, `ptrailT` | green               |
| Hazard     |    4 | `pbrickM`, `ptrailM` | yellow              |

Race mode (`0x00458a80`, after each block): flags `& 0x44` → all projectiles, else `& 0x08` → all hazards, else `& 0x10` → all turbos.

Common brick fields (`0x00453910`): `+0x30` scale, `+0x3c` state (0 available, 1 hidden, 2 appearing, 3 collected, 4 unused), `+0x40` state after collect, `+0x48` respawn delay 3000, `+0x4c` unsigned timer, `+0x50` flags (bit 0 sounds on, bit 1 touched this frame, bit 2 touched last frame). Placement (`0x004539b0`) leaves state 1 with the timer already at 3000.

`0x00453a20` (every frame unless state 4): `timer += dt`; state 2: below 400 ms `scale = t · 0.0025f`, 400..499 `scale = 1 − (t − 400) · 0.002f`; state 3 up to 250 ms `scale = (0.01f · 0.8f) · ((250 − t) · 0.4f)` with `0.01f` and `0.4f` stored by CRT initialisers `0x004538c0`/`0x004538f0`; then the touch bit moves to "last frame".

Touch (`0x00453af0`, from the collision registry `0x0043d270`, which pairs racers with registered objects along a sorted axis): sets "touched this frame"; collects only if the brick is available, the racer is not warping (`+0xd04 & 0x10`) and either it was not touched last frame or the racer holds nothing.

**Power-up brick** (`0x00457640`): update `0x00457710` — hidden until `timer ≥ 3000` → appearing; appearing until `timer ≥ 501` → available at scale 0.8; collected until `timer ≥ 251` → the after-collect state with the stored next kind. Collect `0x00457820`: the racer gets the brick (`0x00439210`: `+0xccc = kind`, `+0xcd8 = 0`, `+0xcdc = 300`). If the racer held nothing the brick hides for 3000 ms and keeps its placed kind; if it held something, **the brick swaps**: it takes the racer's old kind and reappears at once. The constructor writes kind 3 to `+0x64`, which only matters before the first collect.

**Enhancement brick** (`0x004535a0`, models `enh`/`enhblen`): placed appearing with the timer at 3000, so it is available after the first update. Collect `0x00453750` → `0x00439420`: refused at level 3; otherwise the first empty racer slot (`+0xd5c..+0xd64`) takes it, `+0xd58` rises, and reaching 3 plays a taunt. A collected enhancement brick never respawns by itself: it comes back when its racer uses a brick (`0x00439520` → `0x004537f0`, back home and appearing) or after 10,000 ms on the ground when it was dropped. A hit racer drops its first one (`0x00439490` → `0x00453790`): a line probe from 25 above to 25 below the racer (`0x0041f4d0`), the brick 5 above the hit.

## Using a brick (`0x00439100`)

Nothing held → `0x00439c90` (taunt sound `+0xd23`, event system notified). Level = `+0xd58`. Racer description byte `+0xf` (copied by `0x00436df0`): `0x40` → `+0xd04 0x1000000`, every brick fires a level-1 projectile; `0x80` → `0x2000000`, every brick is used at level 3; `0x02` → `0x8000000`, turbo bricks below level 3 are spent without effect and `0x004377f0` starts a level-2 turbo every sub-step while the racer is not tumbling. Projectile → `0x0045a950`; shield → taunt, `0x0045b030`; turbo → `0x0045b1e0`; hazard → taunt, `0x0045a9b0`. Then the brick is gone and the enhancement bricks are released.

Humans call it from the fire button (`0x00430620`). Computers: `0x004377f0` and `0x00438f20` (ported in `racer-ai`; `advanceComputerPowerUpUse` wires them to `usePowerUp`). `0x00439340` (start of a computer race): one low-byte draw below the turbo chance (`+0xd1e`) starts a level-0 turbo.

## Effects

Base (`0x00451350`): `+0x04` state (1 idle, 2 starting, 3 active, 4 ending, 5 final stage, 6 finished), `+0x08` unsigned timer, `+0x0c` next, `+0x14` level. Vtable: 0 touch, 2 update, 3/4 draw, 5 advance (timer ran out), 6 category (1 projectile, 2 shield, 3 turbo, 4 hazard), 7 reset, 8 hit racer. Countdown `0x004513a0`: `timer ≤ dt` → 0 and advance, else `timer −= dt`.

Taking an effect: its free list head, else `0x0045b2e0` steals the active effect of the same category whose level is in the given set, with the highest state and, on a tie, the least time left (state signed, timer unsigned); it is unlinked and reset. With nothing to steal the original dereferences null (the port throws `NoPowerUpEffectToTakeError`).

Attachments (`0x0045b9e0`, lowest free bit of 25): shields need 2 free before they start, magnet, curse and turbo 3 (checked as `25 − used`); a failed allocation finishes the effect at once.

| Effect    | Brick, level | Start                                                                                                                                                              | Timeline (advance)                                                                                                                       | Hit on an unshielded racer                                                                                                   |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Cannon    | projectile 0 | `0x0045aa30`: humans aim at a TGB point (`0x0045c6a0`, 100..160,000, cos 0.95), else the nearest racer (`0x0043ca60`, 100..160,000, cos 0.9); state 2, timer 0     | 2 → 3 for 3000 ms (flight) → 6                                                                                                           | `0x00452370`: owner taunts, victim complains, drops an enhancement brick, `+0x39c                                            | = 2`; then an explosion, debris, end |
| Grapple   | projectile 1 | `0x0045ab50`: farthest racer (`0x0043c910`, 100..62,500, cos 0.93), else nearest (100..160,000, cos 0.6), else (humans) a TGB point                                | 2 → 3 for 3000 → retract (5 for 500) → 6                                                                                                 | `0x004545d0`: voices, drop, latched (4) for 4000 ms, pulling the two racers (not ported)                                     |
| Wand      | projectile 2 | `0x00454cb0`: state 2, 500 ms                                                                                                                                      | 2 → 3 for 7000 → 4 for 500 → 6                                                                                                           | `0x00455440`: racer stopped and thrown, voices, drop, held 1000 ms                                                           |
| Rocket ×3 | projectile 3 | `0x0045af80` → `0x00456560`: three, numbered 0..2; state 2, 3000                                                                                                   | 2 (launch animation) → 3 for 5500 → 6                                                                                                    | `0x00456fa0`: car body slot `+0x24(2.0)`, voices, drop; then as the cannon                                                   |
| Oil slick | hazard 0     | `0x00457230`: state 2, timer 0                                                                                                                                     | 2 → 3 for 10,000 → 6                                                                                                                     | `0x004575b0`: unless tumbling, car body slot `+0x24(1.0)`, `+0x39c                                                           | = 2`, the slick is used up           |
| Barrel    | hazard 1     | `0x0045ad30`: target nearest racer (100..160,000, cos 0.9)                                                                                                         | 2 → 3 (fuse 5000) → explodes, 6; on landing an explosion and 4 for 500 → explosion scattered by `(r % 13) − 6` → 5 for 500 → another → 6 | none (the explosions hurt)                                                                                                   |
| Magnet    | hazard 2     | `0x00455830`: 3 attachments, state 2, 20,000                                                                                                                       | first update places it; advance 4 for 1000 → 6                                                                                           | `0x00455fb0`: first touch arms it (3 for 4000); a racer within 9 units (81 squared) is captured (`0x0043a130`) and complains |
| Curse     | hazard 3     | `0x00452550`: 3 attachments, state 2, timer 0                                                                                                                      | 2 → 3 for 15,000 → 4 for 1000 → 6                                                                                                        | `0x00452da0`: unless cursed, `0x00439900` for 10,000 ms                                                                      |
| Shield    | shield 0..3  | `0x0045bd30`: 2 attachments; a shielded racer's earlier shields finish; 4000/6000/8000/10,000 ms, state 3; `0x00439770`; a curse is lifted                         | 3 → 4 for 1000 → 6 and `0x00439790`                                                                                                      | —                                                                                                                            |
| Turbo     | turbo 0..2   | `0x0045c8f0`: 3 attachments; a racer in turbo has its other turbos finished; 400 ms; boost `0x00429cf0(−0.0025, 125 or 250)`; level 2 sets tumbling (`0x00439570`) | 2 → 3 for 1000/1500/5000 and a taunt → 4 for 700 → 6 (level 2 with race flag `0x2` stays at 3)                                           | —                                                                                                                            |
| Warp      | turbo 3      | `0x0045d560`: refused while warping or pending; magnets holding the racer finish; 500 ms                                                                           | 2 → 3 (off the track, `0x004395d0`) for 1500 → put down ahead, 6                                                                         | —                                                                                                                            |

Shielded victims: projectiles make the victim taunt and the shield take the hit (`0x0043a270`: sound by `r % 3`, `+0xd74 = 500`); a shield above level 1 sends cannonballs and rockets back with the shielded racer as the new owner (`0x00431310`). Hazards: never their owner; on a shield (`0x00456320`) the shield takes the hit and hazards below level 3 are destroyed.

Voices (`0x00439240`, one stack argument): only while `+0xd44` is 0; sound `+0xd40 + r % 6` (+6 for a taunt), then `+0xd44 = r · 4 + 5000`.

## Random draws (the table at `0x004befec`)

Every draw advances the shared position, so cosmetic draws matter for determinism. Ported: voices (2), the shield hit (1), debris (`0x0045b550`: 1, then 2 per piece, `r % 3 + 1` pieces, spread `(r % 100) · 0.004 + d − 0.2`), barrel scatter (2 per explosion), wand jitter (20 per wand at load, one per 50 ms while active in the list), wand sparks (2, next in `r % 300 + 200` ms), oil bubbles (2 per frame), the computer's start turbo (1 low byte) and, through `racer-ai`, the use decision.

## Ported / not ported

**Ported** (`power-ups`): race-mode kinds; both brick classes' state machines, scale and touch rules; collect, swap, drop (with an injected ground probe), release and return; the racer's held brick, enhancement slots and voices; using a brick with the computer abilities; the computer start turbo and permanent turbo; pools, the free and active lists, stealing, recycling and the 25 attachment slots; every class's start, timeline and hit outcome listed above; the cone queries `0x0043c910`, `0x0043c6e0`, `0x0043c7f0` (and `0x0043ca60`/`0x0045c6a0` through `racer-ai`'s `findNearestRacerInCone`); all the random draws above.

**Not ported here, ported by the `projectiles` module (see [projectiles.md](projectiles.md), which lists what is still missing, such as launcher-owned effects and model data)**: projectile movement and collision (classes at `0x00430ca0`, `0x00444250`, `0x00423590`/`0x00423640` rocket homing and its target choice `0x00456680`, `0x00431310` reflection path), so `hitRacerWithProjectile` and `endProjectileFlight` are called by whoever detects the hit; the grapple pull (`0x00453ef0` state 4), magnet pull and slow-down clamp (`0x00455b40`), wand beam geometry and racer hit test (`0x00455100`, `0x00455350`), the turbo's early end (`0x0045ce20`, `0x0042a7f0`), the warp's movement along checkpoints (`0x0045d780`, `0x0045dc90` state 3); explosions (`0x004210b0`..`0x00421b00`) and their damage; debris objects (`0x004517c0`, which also take attachment slots); the collision registry's geometry (`0x0043d270`); models, emitters, sounds and drawing; the targeting indicators `0x0045b7a0`; the hazards' launchers (`+0x1998`). `projectiles` plugs into `updatePowerUps` through its `EffectsUpdater` argument and into the wand's update through a hook between the hold and the sparks (`updatePowerUpEffect`'s fifth argument).

**Open questions**: the meaning of racer flags `0x1000` and `0x8` (named "warp withheld" and "tumbling" by use only); whether `0x0041f4d0` leaves its output untouched on a miss (assumed); the explosion's second argument; that an emitter is always available for the oil slick's bubbles (each frame draws only while it exists).
