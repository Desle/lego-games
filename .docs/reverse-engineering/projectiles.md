# Projectiles and everything that moves

Source: `LEGORacers.exe` (English, 1999-07-22). Addresses are virtual addresses. Float code was read from the disassembly (`DisassembleRange.java`, which stores a value to memory with `FST`/`FSTP` and which it keeps on the x87 stack); the decompiler only gave the structure and the argument order. Anything not proven by code is marked **hypothesis**. The port is `packages/lego-racers/src/modules/projectiles`. It continues [power-ups.md](power-ups.md), which ports the bricks, the use of a brick and each effect's start, timeline and hit outcome, and plugs into it through `updatePowerUps`' `EffectsUpdater`. Names are in `reverse-engineering/names/LEGORacers.exe.txt`.

## How the pieces fit

`PowerUps_Update` (`0x0045a490`) calls every active effect's vtable slot 2, then the explosions, then the debris, then recycles the finished effects. `updatePowerUpsWithProjectiles` does the same through `updatePowerUps(step, context, milliseconds, updateEffects)`: for each active effect, head first, it runs the class's update (the countdown from `power-ups` plus the movement below), then the explosions and the debris, and `power-ups` recycles. The order of the countdown and the movement differs per class and is kept:

| Class   | Order inside slot 2                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Cannon  | countdown (which launches on leaving state 2), then the flight with the time left after the countdown               |
| Grapple | countdown, launch, the hook's advance with the time left, hit, tow                                                  |
| Rocket  | no countdown; the launch animation (state 2), launch, retarget and flight in the same call                          |
| Barrel  | the flight first, then the countdown (which launches on leaving state 2, so the first frame does not fly)           |
| Warp    | the carry along the route (state 3) first, then the countdown                                                       |
| Wand    | countdown, jitter and hold, then the beam and its hit test, then the sparks (`power-ups` calls a hook between them) |
| Magnet  | placement while the timer is still 20,000, countdown, then the pull                                                 |
| Turbo   | countdown, then the early end                                                                                       |

Each moving effect keeps its body in `ProjectileWorld.motions[effectId]` (the original keeps it inside the effect object); it is cleared when the effect finishes. Events for the racer, car body and sound code are `ProjectileEvent`s, in `ProjectileWorld.events`.

## Track queries

`0x0041f730(world, from, to, plane, hitPoint)` is the line probe every flight uses: it calls `0x0041f4d0`, which first tests the world's dynamic sphere objects (`+0xa8`, not ported) and then the track's BVB with `0x00403fa0` (the `collision` module's `getSegmentQueryResult`); a hit on a material with flag `0x20000` counts as a miss, and flag `0x10` has side effects on the world (not ported). `createTrackLineProbe` builds the port's `LineProbe` from a `CollisionVolume` and a material test. The plane's normal is plane floats 9..11. The ground queries of `power-ups` (`GroundQuery`, `0x0041f4d0`) are used for the magnet's and the warp's placement.

## The ballistic body (`0x00430ca0`, vtable `0x004b0778`)

The cannon (`+0x30`), the barrel (`+0xbc`), the grapple (derived, `0x00444250`) and the rocket (derived, `0x00423590`) hold one. Fields: `+0x04` state (1 flying, 2 touched by a racer, 3 hit the track, 4 ran out of time, 0 idle), `+0x08` the model's frame, `+0x0c` the world, `+0x10` start, `+0x1c` target, `+0x28` end, `+0x34`, `+0x38`, `+0x3c` launch velocity (per second), `+0x40` gravity, `+0x48` height offset, `+0x4c` horizontal speed, `+0x50` elapsed, `+0x54` duration, `+0x58` maximum duration, `+0x5c` hit normal, `+0x9c` shooter, `+0xa0` target racer, `+0xa4` touching racer. Vtable: 0 touch `0x00431660`, 1 launch with offset `0x00431220`, 2 launch at a point `0x00431050`, 3 launch at a racer `0x00430d80`, 5 release `0x00431530`, 6 advance `0x00431550`, 7 velocity `0x004316a0`.

The launch parameter block (`0x00430d40`): `+0x00` frame, `+0x04` world, `+0x08` gravity, `+0x0c` the collision registry, `+0x10..+0x18` target offset, `+0x1c` speed, `+0x20` maximum duration, `+0x24` height offset.

- **Arc** (`0x00431450`, argument: the duration in seconds `T`): with `h` the horizontal distance from start to target, `inverse = 1/T`, `vx = dx · inverse`, `vy = dy · inverse` (the differences of y and z are stored first), horizontal speed `h · inverse`, `vz = (dz / h) · speed − (g · h) / (2 · speed)`. Position at `t` seconds: `x0 + t·vx`, `y0 + vy·t`, `z0 + vz·t + t·t·0.5·g`.
- **At a racer** (`0x00430d80`; arguments: parameters, shooter, target, `isFromShooter`, `isLeadLimited`): start at the shooter's frame position raised by `+0x48`, or the model's frame position; the target is its frame position `+5` on z (`0x004b076c`). With `n` the unit horizontal direction and the shooter's heading (`+0x9e0`, speed `+0x9ec`), the closing speed is `|n·heading| · headingSpeed · 1000 + speed`, at least `0.001`; `T = h / closing`, duration `trunc(T·1000)`, and the target is led by the target's velocity (`+0x3f0`) times the milliseconds. With `isLeadLimited` the led point replaces the target only when its offset from the start has a negative dot product with the shooter's `+0x550` axis. Then the parameter offset is added.
- **At a point** (`0x00431050`; arguments: parameters, shooter, point, point velocity, `isFromShooter`): the same without the lead limit and the minimum; the closing speed only counts when the dot product is above 0, the lead is the point velocity times `T` seconds.
- **With an offset** (`0x00431220`): from the model to the parameter offset plus the vector at the parameter speed, no shooter.
- **Advance** (`0x00431550`, milliseconds): a body that is not flying returns its state. Elapsed time is added; at the maximum duration the state becomes 4 and the end is the model's position. Otherwise the arc is sampled and the line probe runs from the model's position to it: a hit sets state 3, the normal and the end, and moves the model to the hit point; a miss moves the model to the sample.
- **Touch** (`0x00431660`): a racer other than the shooter takes a flying body (state 2, touching racer set, end = the racer's frame position).
- **Reflect** (`0x00431310`, argument: the new shooter): the old shooter becomes the target (5 above its frame, led by its velocity times the milliseconds); without one the old start is the target. It starts again from the model with the old horizontal speed.
- **Velocity** (`0x004316a0`): `(vx, vy, elapsed·0.001·g + vz)`.

Parameters per class:

| Class   | Start        | Gravity | Speed | Maximum | Height | Without a target                                                           |
| ------- | ------------ | ------- | ----: | ------- | -----: | -------------------------------------------------------------------------- |
| Cannon  | `0x00451f50` | −32.176 |   180 | 3000    |      5 | track point, else 500 ahead along the owner's forward axis and 5 up        |
| Barrel  | `0x00453240` | −32.176 |    40 | 3000    |      5 | 90 behind (−90 ahead) and 5 up; limited lead at a racer                    |
| Grapple | `0x00454360` | −90.176 |   320 | 3000    |      5 | track point, else 500 ahead and 5 up (the product is stored before adding) |
| Rocket  | `0x00456680` | −32.176 |   170 | 5500    |      4 | 500 ahead, 5 up, 150 to the left (rocket 0) or right (rocket 2)            |

## Cannon and barrel

`Cannon_Update` (`0x00451b50`): the countdown, then, in state 3, the flight with the remaining time. A result other than flying: 2 → the hit (`hitRacerWithProjectile`, with the debris direction `normalize(−vx, −vy, 0)` of the body's velocity; a victim whose shield is above level 1 also turns the body round with `0x00431310`); 3 or 4 → `endProjectileFlight`, a ground burst when the hit normal's z is above `0.7071`. `Barrel_Update` (`0x00452ff0`): the same flight before the countdown; any result other than flying is an explosion through `endProjectileFlight` (ground burst) and the body is released (idle, the model keeps its position for the scatter explosions).

## Grapple (`0x00453ef0`, hook `0x00444250`)

- **Hook advance** (`0x00444490`): retracting (`+0x234` bit 1) → `0x00444690`; touched (state 2) → `0x00444820`; else the ballistic advance.
- **Retract** (`0x00444ac0` starts it at a point): the hook flies to the owner's position (`+0x218` above it, 0 here) with `0x00449a90(target, position, 36, 250, seconds)`: arrived within 6 units, or past the target along the line; it then returns 4 and the effect finishes.
- **Latched** (`0x00444820`): the hook flies to the racer `+2` above its frame at 300 a second (arrival 2 squared), then sticks to it; the rope tension grows 1 per second from the latch and from 1 on the line probe runs from the owner to the hook: a hit returns 3.
- **Effect**: a hit (result 2) when active → `hitRacerWithProjectile` (`0x004545d0`; a shielded victim retracts the hook from where it is, otherwise the effect latches for 4000 ms). Result 3 when active or latched → retract from the end point. Latched with result not 3: a shielded victim, a victim closer than 12 units, or one behind the owner (dot with the owner's forward axis below 0) retract from the victim; otherwise both racers are towed along the unit direction times 180: the owner along it (car body slot `+0x48`, `0x004298f0`), the victim against it (slot `+0x40`, `0x004298a0`). Retracting with result 4 finishes the effect. The timer running out in states 3 or 4 retracts from the hook's position (`0x00454360` cases 3 and 4).

## Magnet (`0x00455b40`)

- **Placement** (`0x004560b0`, before the countdown while the state is 2 and the timer is 20,000): `0x00456360` probes 50 down from the owner's position and puts the magnet 1 above the hit (the owner's position on a miss); the magnet hangs 30 above that. The owner gets `0x00429cf0(0.0015, 150)`.
- **Touch** (`0x00455fb0`): within 9 units (81 squared) of the ground point (the magnet's position `−30` on z) a racer is captured (`power-ups`); a racer outside the range becomes the candidate when there is none.
- **Pull** (after the countdown): a captured racer whose `+0x9ec` is at most `0.002` starts tumbling (`0x00439570`) and caps the timer at 1000 when it is not tumbling yet; unless it has a vehicle object (`+0xb2c`) it is pulled along the unit direction to the ground point with strength `dt` (car body slot `+0x20`, `0x00429770`) until it has stopped and come within 10 units. A captured racer in turbo ends it (`0x0045b690`, `0x00439730`). Without a captured racer the candidate is pulled once and forgotten.

## Wand (`0x00454d70`)

- **Beam** (`0x00455100`): from 3 above the muzzle (`racer +0xe08`), direction `+0x18..+0x20` of that frame. Segment length: `(1 − timer·0.002)·50` while starting, `timer·0.002·50` while ending, else 50. Four segments; the line probe from the origin to the end of four segments shortens the length to a quarter of the hit distance; a held racer bends the beam to it and stops one radius (`racer +0x2c`) short of it. The four points are the origin plus 1..4 segments.
- **Hit test** (`0x00455350`, only while no racer is held): the racers of the cone (3 to 200 units, cosine 0.5, `0x0043c6e0`/`0x0043c7f0`) other than the owner are tested against the four segments with `0x0043fdc0`, a ray–sphere test on the racer's bounding sphere (frame `+0x3c`); a hit calls the wand's hit (`0x00455440`, `power-ups`). The point `0x0043fdc0` writes uses the direction's y for its z (an original bug); the wand ignores it.

## Rocket (`0x004568f0`, body `0x00423590`)

- **Launch** (`0x00456db0` state 2 → 3, when the launch animation ends; the animation is model data, so its length per rocket is `rocketLaunchMilliseconds`, **hypothesis**: `0x0040e360` is true once the animation time reaches its last frame): rocket `k` takes the `k`-th racer of the cone (10 to 400 units, cosine 0.7071, from the owner along its forward axis), else the point of the table above; the body starts at the missile model's position (the owner's position until then) with `isFromShooter` 0. The initial heading is the first axis of the missile frame built from the owner's rotation and the missile skeleton (model data, `rocketHeading`). Wobble amplitude limit 4 and rate 10 (`0x00456887`, `0x00456889`).
- **Initialise** (`0x00423980`): the body's position is the model's; the route node of the shooter (`racer +0xcc4`) is kept when its plane normal has a dot product of at most 0 with the heading, else dropped.
- **Retarget** (`0x00423640`, every update): the timer grows by the step; the target is chosen again when there is none, after 1000 ms, or when it is struck by lightning (`racer +0xaa8` bit `0x80`), shielded or warping (`racer +0xd04` bits `0x11`): the first racer of the cone (from the body's position along its heading) that is not the shooter and not struck, shielded or warping. Without a ground point it advances the route node: it is kept while ahead of the body and at least 10 units in front of its plane; otherwise the next node is taken, dropped when more than 300 units away, and the walk goes on while the next node's normal has a dot product of at most 0 with the heading (else the node is dropped). The node's ground point is probed from 5 above to 50 below and the point 6 above the hit is kept.
- **Advance** (`0x00423a20`): the target's position is 5 above its frame; the heading is the stored difference to the guided position. Within 60 units (3600 squared) the rocket flies straight at it at its launch speed (the length of the launch velocity), has arrived within 3 units (9 squared) or when the step passes it (the dot product of the remaining offset with the heading is at most 0): state 4, the end and the model go to the target. Farther away, or without a target, it follows its heading at its horizontal speed, steering to its ground point while that is ahead (else forgetting it), and keeps 6 units above the track: probe from 2 above to 6 below the new position; on a hit the height is at least the hit `+6`, and it sinks at most 6 a second. The guided position is stored; the wobble (`0x00423ed0`) is then added to the position the line probe sees: amplitude grows 6 a second to its limit, the angle by the rate, and the offset is the column of the rotation about the heading that takes z, times the amplitude. A probe hit is state 3.
- **Effect**: the same handling of the result as the cannon (the debris direction comes from the body's velocity slot `0x00423ea0`). Rockets do not count down.

## Warp (`0x0045d780`, `0x0045dc90`)

- **Carry** (state 3, before the countdown): the racer's position moves `dt · 0.6` units along the route's nodes (`0x0041eaf0`: it snaps to each node it reaches and goes on to the node's next index; the first node when the racer has none).
- **Landing** (when the countdown ends the warp, `0x0045dc90` state 3): `0x0045e080` probes from 5 above to 50 below the racer and puts it 5 above the hit (5 above where it is on a miss); the racer faces the negative plane normal of the next route node (+x without one), its velocity is cleared and car body slot `+0x20` is given 700 (**hypothesis**).

## Turbo (`0x0045ce20`)

After the countdown, a racer that is tumbling (`+0xd04` bit 8) in an active turbo with less than 4500 ms left, whose car body speed (`+0x604`) is strictly between −0.04 and 0.04 (`0x0042a7f0`), ends the turbo early (the class's advance).

## Explosions (`0x004210b0`)

Two pools in the power-up system: `+0x193c` six "Explsn" objects, `+0x1940` two "spikexp" ones, each `0x270` bytes, free lists at `+0x1944`/`+0x1948`, built by `0x00459b80` with the same parameters except the final scale (5 and 10): growth 1000 ms, scar 5000 ms, kind (`+0x22c`) 2.

- **Start** (`0x0045b470`/`0x0045b4f0` → `0x00421520`): the free list's head, else `0x0045b3a0` takes the fading explosion with the least time left, else the growing one with the least time left, else the newest. It goes to the head of the active list. Outside ±2048 on any axis it stays idle (and is recycled in the same frame); else it grows from progress 0.05 with rate `2/T` and acceleration `(1/T)²·2·(0.95 − 2/T)` (`T` the growth in seconds), remaining time the growth.
- **Update** (`0x004217d0`, `0x00421850`): growing: with the step at least the remaining time, a ground burst whose scar texture exists (`+0x214`; assumed present) fades for 5000 ms, anything else goes idle; otherwise `rate = a·dt + rate`, `progress = rate·dt + progress` (semi-implicit), frame scale `(final − 0.1)·progress + 0.1`. Fading counts the remaining time down in the same call. `PowerUps_Update` returns idle explosions to the head of the free list in active-list order.
- **Blast** (`0x00421c00`, from the collision registry): not the owner, not shielded, and (not struck by lightning, or a computer): car body slot `+0x38` (`0x004397a0`), velocity cleared, and slot `+0x1c` (`0x00429a70`) gets `(0 + a_x·80p, 0 + a_y·80p, 200p + a_z·80p)` with `a` the racer's `+0x550` axis and `p = clamp(2·remaining/growth, 0, 1)` (1 when above 1). The kind-1 branch (car body slot `+0x24`) is never taken: both pools use kind 2.
- The frame scale times the model's radius is the explosion's collision volume (model data, not ported); the caller supplies the extents.

## Debris (`0x004517c0`, pool at `+0x18bc`)

Five pieces (`0x14` bytes) and four models. A throw (`0x0045b550`, ported in `power-ups` with its draws) takes the first piece that is not playing, the lowest free attachment slot (`0x0045b9e0`; nothing happens when none is free), and the next model (`+0x78`, mod 4); the animation is `+0x7c` modulo the model's animation count. A playing piece's animation ends in `0x00451860`, which frees the slot (`0x0045ba40`) and resets the piece. The animation lengths are model data (`debrisAnimations`). Slots held by debris are not available to shields, turbos, magnets and curses.

## Collision registry (`0x0043d180`)

Each update: inactive entries are removed from the object list (`0x0043d200`), racer volumes are updated, the object list is insertion-sorted (stable) by the minimum extent of its volume (`0x0043d3f0`), pairs are found (`0x0043d270`) and the list is cleaned again. For each racer (list `+0x2c`, active, with a volume at `racer +0xe0`) the objects are walked from the first active one whose maximum extent reaches the racer's minimum; an object with flag `0x8` skips computer racers, with `0x10` human ones; the walk stops at an object whose minimum extent is past the racer's maximum; the precise test is the racer volume's slot 6 (`+0x18`); a hit calls `0x004408e0` on the entry: it counts contacts (`+0x20`), flag `0x2` only calls every `+0x10`-th, counts calls (`+0x1c`) and, without flag `0x1`, retires the entry at `+0x0c` calls. Registration (`0x0042fb50`/`0x004408b0`) takes six dwords: type, flags, maximum calls, interval, frame. Projectiles register `4, 1`, explosions `5, 1`.

## Ported / not ported

**Ported** (`projectiles`): the ballistic body (all three launches, arc, advance, touch, reflect, velocity); the cannon and barrel drivers; the rocket's launch, retargeting, route following, homing flight and wobble; the grapple hook (flight, latched hook, retract) and its tow; the wand's beam and hit test; the magnet's placement, capture range, candidate and pull; the turbo's early end; the warp's carry and landing; the explosions' pools, growth, stealing and blast; the debris pool and its attachment slots; the collision registry's pairing, sorting and call counting; the track probe over the `collision` module. The order of countdown and movement per class.

**Not ported**:

- Model, animation and emitter data: the rockets' launch animation lengths and the missile heading (`rocketLaunchMilliseconds`, `rocketHeading`), the debris animation lengths (`debrisAnimations`), the racers' bounding spheres, the explosions' model radii and whether the scar texture exists. They are inputs.
- Launcher-owned effects (the hazards at power-up system `+0x1998`): the cannon from a launcher, the warp to a destination (`0x0045d780`'s interpolation), the wand from a launcher.
- The world's dynamic sphere objects in the line probe (`0x0041f4d0`). The material side effects of flag `0x10` (and the pass-through of flag `0x20000`) are ported: [surface-signals.md](surface-signals.md).
- The car body, rigid body and racer reactions the events ask for (`0x00429770`, `0x004298a0`, `0x004298f0`, `0x00429a70`, `0x00429cf0`, `0x00439570`, `0x004397a0`).
- Drawing, sounds, smoke, sparks and rope models; the barrel's spin; the hook's rope sag fields (`+0x218`..`+0x224` except the tension).
- The registry's racer-volume update (`0x0043aa10`) and sort, the volume extents and the precise test: callers pass them.

**Open questions**: the meaning of racer `+0x9e0`/`+0x9ec` (named heading and speed by use), `+0x550` (the axis the blast pushes along and the barrel's lead test uses), `+0xb2c` (named `isVehiclePresent`), `+0x218` of the grapple body (taken as 0: its only writer, slot 8 `0x00444340`, has no direct caller); how `0x0040e360` decides that an animation has ended; whether `0x0042a7f0`'s `+0x604` is the car body's speed (`racer.md` says so); the second argument of car body slot `+0x20` after a warp.
