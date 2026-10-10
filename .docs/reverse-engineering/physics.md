# Race physics: time steps, racer objects and the rigid body

Source: `LEGORacers.exe` (English, 1999-07-22). Addresses are virtual addresses. Every float rule below comes from the disassembly (`DisassembleRange.java`), not from the decompiler, which reorders x87 operands and hides which intermediate values are stored. Anything not proven by code is marked **hypothesis**. The port lives in `packages/lego-racers/src/modules/simulation-math` and `.../racer-physics`; names are in `reverse-engineering/names/LEGORacers.exe.txt`.

## Time: `Race_Update` (`0x00435220`)

```c
dt = application->frameDelta;                  // +0x824, uint32 milliseconds (see game-map.md)
if (settings->flags & 0x100)                   // settings = race +0x04, flags at +0x20
    dt = _ftol((float)(int)dt * 1.75f);        // FILD dword, FMUL [0x004b08c0] = 0x3fe00000, CALL 0x004a84b0
if (race[0x30c0] == 0 || (0x00427420(race + 0x3058, dt), race[0x30a0] == 2 && (0x00436160(race), race[0x30c0] != 3))) {
    … whole-frame updates with dt (timers, power-ups, events, hazards, emitters, sound, player controllers) …
    remaining = dt;
    while (remaining > 0) {                    // TEST EDI,EDI / JBE, then JA (unsigned) at 0x0043546f
        if (remaining > 40) { step = 40; remaining -= 40; }   // CMP EBP,0x28 / JBE
        else                { step = remaining; remaining = 0; }
        RacerSet_Step(race + 0x3bc, step);                    // 0x0043c030
        for each local player (settings +0x32c): Camera_Update(race + 0x2ad4 + 0x150·i, (float)step);  // FILD, FSTP float
        if (race[0x3364]) GhostRecorder_RecordSample(race[0x3364], step);                            // 0x00422710
    }
    … trailing updates with dt (0x00492870, 0x0048ae00, Sky_Update, 0x004351f0 in states 2–4) …
}
```

Rules, all ported (`getRaceTimeStep`, `getPhysicsSubSteps`, `updateRacePhysics`):

- The time step is the integer frame time, or `trunc(frameTime · 1.75)` when settings flag `0x100` is set. `_ftol` truncates toward zero; `1.75 · n` is exact for any frame time below 2²², so the precision does not matter here.
- The step is split into 40 ms pieces while more than 40 ms remain, then the rest: 100 → 40, 40, 20; 175 → 40, 40, 40, 40, 15; 40 → 40; 41 → 40, 1; 0 → nothing.
- Each piece runs, in this order: all racers, every local player's camera, the ghost recorder.
- **Not ported**: the guard on `race +0x30c0` and everything before and after the loop.

### `RacerSet_Step` (`0x0043c030`, thiscall: step)

The racer set is at race `+0x3bc`; its racers are an array at `+0x140` with the count at `+0x144`, stride `0xe34`. For one sub-step it runs nine passes, each over all racers unless noted:

1. Driver figure (racer `+0xc70`): if figure `+0x14` & `0x80` → `0x0041fd60`; else if figure `+0x98` == 2 → `0x004203b0` when figure `+0x14` & `0x40`; else `RacerDriver_Update` (`0x0041fc00`, step).
2. Car body (racer `+0x3e8`): virtual slot `+0x04`, which is `CarBody_Update` (`0x004293f0`) in vtable `0x004b04e4`.
3. Racers with racer `+0xd04` & `0x80`: `0x00437b50`.
4. Once: racer set `+0xf0` object, virtual slot `+0x10` (step).
5. `0x00437740` (racer, step).
6. `0x00437d40` then `0x00437be0` (racer).
7. `0x004377f0` (racer, step).
8. Once: `0x0043c1b0` (racer set).
9. Once: `0x0043a480` (racer set `+0x284`, step).

Ported in the `racer` module; see [racer.md](racer.md) for the passes, what is ported and the dependencies that stand in for the rest.

### `CarBody_Update` (`0x004293f0`, car body vtable `0x004b04e4` slot 1)

If car body `+0x744` is 0 it runs `RigidBody_Step` (`0x00444ef0`), otherwise `0x00429d40`. After the step it saves the frame position (`+0x700`) and the rotation as a quaternion (`Math_MatrixToQuaternion` into `+0x70c`) when `+0x36c` == 4 and `+0x3ec` == 0 (**hypothesis**: all four wheels down and no contact); when the position's third component leaves the range in `0x004b04dc`/`0x004b04d8`, or the racer flags `+0xd04` have both `0x400` and `0x2`, it restores them (`Math_QuaternionToMatrix`) and zeroes the linear velocity and angular momentum (**hypothesis**: respawn). Ported in the `racer` module ([racer.md](racer.md)) around `RigidBody_Step`.

### `RigidBody_Step` (`0x00444ef0`, car rigid body vtable `0x004b0d8c` slot 1, thiscall: milliseconds)

Ported as `stepCarRigidBody(arithmetic, body, { stepMilliseconds, collisionObjects }, hooks)`. The four virtual calls it makes are `hooks`: slot `+0x0c` (hull contact filter; car body `0x0042a830`), `+0x10` (after every pass; car body `0x0042a900`, surface effects), `+0x2c` (spin's yaw timer ran out; `0x004482e0`, car body `0x00429cd0`) and `+0x3c` (flag-`0x80` countdown ran out; `0x00448820`, car body `0x00429c30`). `CAR_RIGID_BODY_HOOKS` is the car rigid body's own behaviour; the car body's `+0x2c`/`+0x3c` do the same while `+0x744` is 0, and `+0x0c`/`+0x10` (racer code) are not ported.

1. `RigidBody_ClearContacts` (`0x00447880`).
2. Timers, all in milliseconds (`0x00444f0b..0x0044507d`), with `s` = the step:
   - flag `0x80`: if `s < +0x6e0` it counts down, else slot `+0x3c`.
   - flag `0x2` set: with flag `0x4` that flag is cleared and nothing else; else if `s < +0x5e0` it counts down; else if `+0x5e0` ≠ 0 the **sub-step is shortened to `+0x5e0`** (`MOV EDI,EAX`) and the timer becomes 0; else slot `+0x2c`.
   - flag `0x2` clear: if `s < +0x5e0` it counts down, else it becomes 0, the angular momentum about rotation row 2 is removed (`0x00440da0`) and flag `0x800` is cleared. With the timer at 0 this happens every step: yaw momentum never survives a step unless something set the yaw timer (`0x00445c30`).
   - `+0x5e4`: 0 when `s` is larger, else counts down. `+0x5d8` / `+0x5dc` (when non-zero): count down while `s` is smaller, else become 0 and the momentum about row 0 / row 1 is removed.
   - Every countdown after the yaw timer uses the shortened `s`.
3. Flag `0x8`: `0x00448840` (**not ported**). `+0x3f0` = `s`; `0x004474c0` saves the pass start (velocity, position, rotation via frame slot `+0x44`, world inverse inertia, angular velocity and momentum, `+0x658`, `+0x680`, the heading `+0x168`, each wheel's anchor, material, flags and `+0x50..+0x6c`, and the world hull points), and copies each wheel's material `+0x3c` to `+0x40`.
4. The loop (`0x00445082..0x00445195`), `r` = milliseconds to run, starting at `s`:
   - Top: no contact and `r` = 0 → done. With `r` ≠ 0, a pass: `0x00445500` forces, `RigidBody_Integrate(r)`, `0x00445d10` tilt limit, `0x00445dc0` ground probes (or flag `0x8`: `0x004464a0`, `0x004465c0`, **not ported**), `0x00446fd0` heading, `0x00447330` velocity split, slot `+0x10`, frame slot `+0x2c` (world centre of mass), `0x00440a60`.
   - No contact pending: `r = RigidBody_AdvanceToContact(r, !(flags & 0x1000))`. `r` ≠ 0 → loop; `r` = 0 → done when a contact was answered before (contact count is then set to 1), else loop (which ends, or answers a contact found less than 5 ms ahead).
   - Contact pending: with `r` ≠ 0 it advances again; while contacts keep coming, `r` is the new time and the loop re-runs from the restored start. When the advance finds nothing (or `r` was 0): `0x00447cf0` answers the contact, `0x00447330`, contacts cleared, the pass start saved again, `+0x3f0 -= r`, and `r = +0x3f0` (the rest of the step).
   - So a hull contact undoes the pass, re-runs it up to 5 ms before the contact, answers the contact, and runs the rest of the step; a second contact within 5 ms ends the step at that pass's start with contact count 1.
5. `+0x6dc` += the original step while `+0x36c` is 0, else 0. The sound objects `+0x6e8` (position, velocity and a pitch from `+0x618`, `+0x6d8`) and `+0x6e4` (position) are updated (**not modelled**), then `0x004452b0` (lean).

### Forces: `0x00445500` (`applyCarForces`)

`+0x164` = -(gravity `+0x160`) × scaled mass `+0x15c`; `+0x650` = 0. A drifting body (flag `0x1`) whose velocity direction `+0x5f8` · row 0 ≤ 0 ends the drift (`0x00448070`).

- **Airborne** (`+0x36c` = 0): force (0, 0, 4 × weight) (`0x004b0d10`); throttle × scaled mass along the heading `+0x168`, its z never above -weight; with a turn radius `+0x64c` ≠ 0 and flag `0x800` clear, yaw rate = forward speed / radius for 200 ms (`0x00445c30`).
- **Grounded**: the average wheel grip `+0x54` and skid grip `+0x58` (sum × 0.25, `0x00448990`, `0x004489c0`); the slope force `+0x180` is applied when gravity × scaled mass × grip < |slope force|. Without the roll and pitch timers, each grounded wheel (with fewer than three down) adds the torque of its ground force `+0x00` at its anchor `+0x0c`, and `0x00440cb0` removes the momentum about (opposite wheel's anchor − centre of mass) × ground normal (opposite wheel from the table at `0x004b0d40`: 3, 2, 1, 0). Drifting or spinning (flags `0x3`): a brake force -(gravity × scaled mass × skid grip × `+0x6d0`) along the velocity direction, and the side friction is scaled by 1 − `+0x6d0`. Spinning or after a wall (flags `0x2`, `0x800`): side friction mass × -0.002 × lateral velocity. Otherwise: side friction mass × -0.01; throttle × scaled mass along row 0 (three or more wheels, not drifting) or the heading, or without throttle rolling friction mass × -0.001 × forward velocity; with a turn radius a centripetal force (mass × v² / radius, stored at `+0x648`) toward the left of the heading, and the yaw rate: drifting, `+0x6c4` × v / radius unless row 0 · velocity direction < `+0x6c8`; otherwise v / radius, with v raised to 0.03 between 0.0005 and 0.03.
- Then (flags `0x88` clear) the wheels' surface forces `+0x64..+0x6c` summed × scaled mass × 0.25; a drag -((average `+0x50` (0 with flag `0x8`) + `+0x5ec`) × speed) × velocity; and the extra forces `+0x630` (flag `0x20`), `+0x63c` (flag `0x40`).

### Ground probes: `0x00445dc0` (`probeGround`)

- A body at rest (flag `0x100` and zero linear and angular velocity) is skipped. The eight triangle cache entries age by one.
- Probe height = the model frame's bounding radius (`+0x13c` frame `+0x10`, `0x00411ca0`) + how far the body dropped since the pass start (never negative). Probe depth = step × 0.04 when wheels were down and flag `0x80` is clear, else 0.
- The wheel count becomes 0, the anchors are recomputed (`0x00448c70`: wheel 1 = frame point `+0x358`; wheel 0 = wheel 1 − track width `+0x364` × row 1; wheel 3 = wheel 1 − wheelbase `+0x368` × row 0; wheel 2 = wheel 0 − wheelbase × row 0), each wheel's flags, ground force and depth (−FLT_MAX) are reset.
- Moving objects (collision list entries 1..): `0x00448d90` builds every wheel's probe in the object's frame (anchor + height × the world's z axis to anchor − depth × it); unprobed wheels query the object's volume, and a hit gives the material, the contact point and the normal in world space, and the squared depth.
- The track (entry 0), in world space, for the wheels still unprobed: probe from (anchor + height) to (anchor − depth) straight down; first the triangle cache (`0x00448ae0`: the wheel's own triangle, then the others, each through `0x00448b80`), else `0x00403fa0`, whose hit is cached (`0x00448a70`: a free entry, else the first of the oldest). The ground force is the triangle's normal.
- Nothing hit: if wheels were down, v.z −= 0.008. Otherwise the wheels within (√deepest − 0.4)² of the deepest hit are grounded and their normals summed into `+0x174`; `0x00448430` settles the frame (with two or more down, rows 0 and 1 follow the wheel pairs' contact points, `0x00410a00`; the frame moves by the reference wheel's contact − anchor + `+0x18c`, which is (0, 0, 0.2)). With three or more down the ground normal is row 2 and the count is set to **4** — so `+0x36c` == 4 means "three or more wheels down, aligned to the ground", not "all four". Else the normal is normalized.
- After more than 400 ms airborne, a landing removes the velocity into the ground; faster than 0.05 it bounces (v.z −= 1.15 × v·n) and the wheels leave the ground again.
- The slope force `+0x180` = weight along the ground; each grounded wheel's ground force becomes (0, 0, weight × −1/(count + 8)).

### Heading and velocity: `0x00446fd0`, `0x00447230`, `0x00447330`

The heading `+0x168` follows rotation row 0 (laid into the ground plane with one or two wheels down): it snaps when the dot product exceeds 0.98 or the angle (table at `0x004c07ec`, below) is under step × 0.0025, else turns that far (`0x004496a0`). Drifting under throttle with three or more wheels down, it turns about z by step × yaw rate `+0x650`, but at most `+0x6cc` from row 0. `0x00447330` stores the speed `+0x604`, its direction `+0x5f8` (row 0 when still; flag `0x100` when also not rotating), and the split along the heading (`+0x60c`, `+0x618`) and across it (`+0x61c`).

The arccosine table at `0x004c07ec` is initialized data: 1,024 float32, indexed by `-_ftol((cos + 1) × -511.5)` (`0x004af870` = `0xc3ffc000`). Entry k equals `fround(acos(-1 + k / 511.5))` except entries 396, 681 and 830, which are one unit in the last place lower; the port computes the table and lists the three exceptions.

### Hull contacts: `RigidBody_AdvanceToContact` (`0x004478b0`) and `0x00447cf0`

- The four hull points `+0x370` go to world space (`+0x3a0`). Each runs as a segment from where it was at the pass start to where it is now: against every moving object (in its frame), then (argument 2, `!(flags & 0x1000)`) the track. A hit counts when the end point lies behind the triangle (`(hit − end) · normal` > 0 for objects, ≥ 0 for the track) and slot `+0x0c` accepts it; the hit whose end lies farthest from the hit point wins: its world normal goes to `+0x3e0` and its fraction is kept. Each point counts once.
- With a contact: the **`_ftol` argument is `(float)step × fraction`** (`FILD [ESP+0x58]`, `FMUL [ESP+0x28]`); the body is restored to the pass start (`0x00447690`, which also recomputes the world centre of mass and runs `0x00447330`) and the result is that time − 5, or 0 below 5.
- `0x00447cf0` (the answer): a drift ends; the velocity into the surface is removed; when row 0 faces the surface (flag `0x2` clear) the car turns away at ±0.004 × ((1 ∓ row 1 · n) / 2 + 0.5) for 200 ms and flag `0x800` is set; the car bounces 0.3 of the impact back (0.15 vertically), is pushed 0.004 off the surface, and v.z is capped at 0.3.

### Lean: `0x004452b0`

With flag `0x400` (`0x00449070`) and |turn radius| ≥ 40 the target lean is -(1/radius) × 40 × `+0x6d8` × speed × 1000 / `+0x608`, clamped to ±0.5 (with flag `0x8`, −`+0x680`). The lean `+0x6d4` moves toward it by step × 0.002. The model frame `+0x13c` gets the body's rotation with row 2 turned about row 0 by the lean (`0x004496a0`, `0x00410900`) and the position raised by tan(|lean|) × track width / 2 (`FPTAN`); with no lean it copies the body frame.

### Car rigid body fields (`CarRigidBody`)

| Offset                                 | Port field                                                            | Meaning                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x13c`                               | `displayFrame`, `displayBoundingRadius`                               | The model frame (racer `+0x5c`) the lean moves; its bounding radius sets the probe height                                                                                                                                                                                                                                                     |
| `+0x140..+0x154`                       | `CarRigidBodyStepInput.collisionObjects`                              | Collision list (track first, at most five; `0x004488e0` adds, `0x00448930` removes)                                                                                                                                                                                                                                                           |
| `+0x15c`, `+0x160`, `+0x164`           | `scaledMass`, `gravity`, `weight`                                     | mass × 0.001 × 0.001; 39 (`0x004b0ce4`); −gravity × scaled mass                                                                                                                                                                                                                                                                               |
| `+0x168`                               | `heading`                                                             | Driving direction                                                                                                                                                                                                                                                                                                                             |
| `+0x174`, `+0x180`, `+0x18c`           | `groundNormal`, `slopeForce`, `settleOffset`                          |                                                                                                                                                                                                                                                                                                                                               |
| `+0x198..+0x358`                       | `wheels` (`CarWheel`, 0x70 each)                                      | `+0x00` ground force, `+0x0c` anchor, `+0x18`/`+0x24` probe, `+0x30` contact point, `+0x3c`/`+0x40` material and previous material, `+0x44` cached triangle, `+0x48` flags (`0x1` on ground, `0x2` probed), `+0x4c` depth², `+0x50` drag, `+0x54` grip, `+0x58` skid grip, `+0x5c` grip (`0x004489f0`), `+0x60`, `+0x64..+0x6c` surface force |
| `+0x358`, `+0x364`, `+0x368`           | `localWheelAnchor`, `trackWidth`, `wheelbase`                         | `0x00446e60`                                                                                                                                                                                                                                                                                                                                  |
| `+0x36c`                               | `groundedWheelCount`                                                  | 0–3, or 4 for "three or more, aligned"                                                                                                                                                                                                                                                                                                        |
| `+0x370`, `+0x3a0`, `+0x3d0`           | `localHullPoints`, `worldHullPoints`, `hullContacts`                  | `0x00446ea0`                                                                                                                                                                                                                                                                                                                                  |
| `+0x3e0`, `+0x3ec`, `+0x3f0`           | `contactNormal`, `contactCount`, `stepRemaining`                      |                                                                                                                                                                                                                                                                                                                                               |
| `+0x3f4..+0x5d4`                       | `triangleCache`                                                       | 8 × (13-float triangle, age `+0x34`, material `+0x38`), count `+0x5d4`                                                                                                                                                                                                                                                                        |
| `+0x5d8..+0x5e8`                       | `rollTimer`, `pitchTimer`, `yawTimer`, `spinTimer`, `spinPeriod`      |                                                                                                                                                                                                                                                                                                                                               |
| `+0x5ec`, `+0x5f4`                     | `drag`, `gripScale`                                                   | `0x004483b0`: mass × \|throttle\| / top speed²                                                                                                                                                                                                                                                                                                |
| `+0x5f8`, `+0x604`, `+0x608`           | `velocityDirection`, `speed`, `topSpeed`                              | Top speed 110 after `0x00444b40` (slot 6)                                                                                                                                                                                                                                                                                                     |
| `+0x60c`, `+0x618`, `+0x61c`           | `forwardVelocity`, `forwardSpeed`, `lateralVelocity`                  |                                                                                                                                                                                                                                                                                                                                               |
| `+0x628`                               | `throttle`                                                            | Slot 5                                                                                                                                                                                                                                                                                                                                        |
| `+0x630`, `+0x63c`                     | `extraForceA`, `extraForceB`                                          | Slots 16–19                                                                                                                                                                                                                                                                                                                                   |
| `+0x648`, `+0x64c`, `+0x650`           | `centripetalForce`, `turnRadius`, `yawRate`                           | Turn radius clamped by `0x00446ef0` (racer)                                                                                                                                                                                                                                                                                                   |
| `+0x658..+0x680`                       | `twoPointHeight` … `twoPointTilt`                                     | Flag `0x8` mode                                                                                                                                                                                                                                                                                                                               |
| `+0x684..+0x6bc`                       | `stepStart`                                                           | Pass start (with globals `0x004c6df0..0x004c6ee0`)                                                                                                                                                                                                                                                                                            |
| `+0x6c0`                               | `flags` (`CarRigidBodyFlag`)                                          | `0x1` drift, `0x2` spin, `0x4` spin started, `0x8` two-point, `0x20`/`0x40` extra forces, `0x80` flagged timer, `0x100` at rest, `0x200`, `0x400` lean, `0x800` wall turn, `0x1000` no track contacts                                                                                                                                         |
| `+0x6c4..+0x6d0`                       | `driftYawFactor`, `driftThreshold`, `driftMaximumAngle`, `driftBrake` | Set by `0x00447f30` (racer's `startCarBodySlide`)                                                                                                                                                                                                                                                                                             |
| `+0x6d4`, `+0x6d8`, `+0x6dc`, `+0x6e0` | `lean`, `leanFactor`, `airborneTime`, `flaggedTimer`                  |                                                                                                                                                                                                                                                                                                                                               |

The racer's `CarBody` (`racer` module) holds this as `rigidBody` and adds the car body's own fields from `+0x6f0`.

## Racer object (`0xe34` bytes, constructor `Racer_Constructor` `0x00436990`, vtable `0x004b09b0`)

| Offset   | Type             | Meaning                                                                                                                 |
| -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `+0x000` | vtable           | `0x004b09b0` (base `0x004b016c`, pure virtual)                                                                          |
| `+0x018` | object           | Vehicle (`0x0043d5a0`, `Vehicle_Update` `0x0043e070`)                                                                   |
| `+0x3e8` | object (`0x888`) | Car body: a car rigid body (`CarBody_Constructor` `0x00429020`, vtable `0x004b04e4`); stepped by `RacerSet_Step` pass 2 |
| `+0xc70` | object           | Driver figure (`0x0041fb50`); `+0xc84` flags (`0x80`, `0x40`), `+0xd08` state (2 handled separately)                    |
| `+0xd04` | uint32           | Flags: `0x80` (pass 3), `0x400` and `0x2` read by `CarBody_Update` through car body `+0x6f0`                            |
| `+0xdec` | object           | Constructed by `0x00449e10` (unknown)                                                                                   |

The car body's size is inferred from the next member (`0xc70 - 0x3e8`).

## Rigid body

Class chain: `RigidBody` (`0x00440950`, vtable `0x004b0b78`: slot 1 `RigidBody_Integrate`) → `BoxRigidBody` (`0x004411d0`, vtable `0x004b0b84`: slot 0 `BoxRigidBody_ComputeInertia`) → car rigid body (`0x00444b10`, vtable `0x004b0d8c`: slot 1 `RigidBody_Step`) → car body (`0x00429020`, vtable `0x004b04e4`: slot 1 `CarBody_Update`). All floats are float32.

| Offset           | Type    | Meaning (port field)                                                                                                                                                           |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `+0x00`          | vtable  |                                                                                                                                                                                |
| `+0x04`          | pointer | The frame the body moves (`frame`); set by `RigidBody_Attach` (`0x004409f0`). For the car it is the embedded frame `+0xe4` (`0x00444d90` passes `this + 0xe4` to `0x00441210`) |
| `+0x08..+0x10`   | vec3    | Linear velocity, units per millisecond (`linearVelocity`)                                                                                                                      |
| `+0x14..+0x1c`   | vec3    | Centre of mass in frame space (`localCentreOfMass`), set by `0x00441190`                                                                                                       |
| `+0x20..+0x28`   | vec3    | Centre of mass in world space (`worldCentreOfMass`): frame slot `+0x2c` (`0x00410d60`, point × rotation + position)                                                            |
| `+0x2c..+0x4c`   | 3×3     | Inertia in frame space (`localInertia`)                                                                                                                                        |
| `+0x50..+0x70`   | 3×3     | Its inverse (`localInverseInertia`)                                                                                                                                            |
| `+0x74..+0x94`   | 3×3     | Inverse inertia in world space (`worldInverseInertia`) = transpose(R) · `+0x50` · R, by `0x00440a60` → `0x00410f30`                                                            |
| `+0x98..+0xa0`   | vec3    | Angular velocity (`angularVelocity`) = `+0xa4` (row vector) · `+0x74`, by `0x00440a80`                                                                                         |
| `+0xa4..+0xac`   | vec3    | Angular momentum (`angularMomentum`)                                                                                                                                           |
| `+0xb0..+0xb8`   | vec3    | Force accumulator (`force`), `RigidBody_AddForce` `0x00440b10`, cleared by the integrator                                                                                      |
| `+0xbc..+0xc4`   | vec3    | Torque accumulator (`torque`), `0x00440b50`, cleared by the integrator                                                                                                         |
| `+0xc8`          | float   | Mass (`mass`), 1.0 after reset                                                                                                                                                 |
| `+0xcc`          | float   | 1 / mass (`inverseMass`)                                                                                                                                                       |
| `+0xd0..+0xd8`   | vec3    | Box dimensions (`dimensions`), set by `BoxRigidBody_Attach` (`0x00441210`)                                                                                                     |
| `+0xdc`, `+0xe0` | float   | 1.0 and 0 after `0x00441210` (unknown, not modelled)                                                                                                                           |
| `+0xe4..+0x13b`  | frame   | The car rigid body's embedded frame (`Frame_Constructor` `0x004108a0`): rotation at `+0x10c`, position at `+0x130`                                                             |
| `+0x13c..+0x6e0` | —       | Car rigid body members: see the table above (`CarRigidBody`)                                                                                                                   |

`BoxRigidBody_ComputeInertia` (`0x00441260`), with `a, b, c` the dimensions and `m` the mass: `Ixx = (c² + b²) · (m / a) · (1/12)`, `Iyy = (c² + a²) · (m / b) / 12`, `Izz = (b² + a²) · (m / c) / 12` (`1/12` is the float32 `0x3daaaaab` at `0x004b0b90`). The mass is divided by the dimension on the same axis, unlike a solid box. Off-diagonals are zeroed; the inverse diagonal is `1 / Ixx` and `1 / Iyy` from the stored values and `1 / Izz` from the unrounded one still on the stack.

### Frame (vtable `0x004af700`, `0x004af754` for the derived class)

| Offset         | Meaning                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `+0x04..+0x0c` | Bounding-sphere centre (used by `0x00411b90`)                                           |
| `+0x10`        | Bounding-sphere radius; `Frame_SetPosition` writes -1.0 to mark it stale (not modelled) |
| `+0x28..+0x48` | Rotation, row-major 3×3; row vectors multiply from the left (`rotation`)                |
| `+0x4c..+0x54` | Position (`position`)                                                                   |

Slots used by the integrator: `+0x04` `Frame_GetPosition` (`0x00410ea0`), `+0x08` `Frame_SetPosition` (`0x00410ec0`), `+0x48` `Frame_GetAxes` (`0x00403c90`, rows 0 and 2), `+0x40` `Frame_SetAxes` (`0x00410900`).

## `RigidBody_Integrate` (`0x00440e10`, thiscall: integer milliseconds)

Ported as `integrateRigidBody`. `t` is the step converted once (`FILD`, `FSTP float`); "store" means an `FSTP float` to memory.

1. `ω = L · I⁻¹world` (`0x00440a80`, stored to `+0x98`).
2. `Δv = (F · t) · (1/m)` per axis, stored; `h = t · 0.5` (`0x004af58c`), stored.
3. `position = ((v · t) + (h · Δv)) + position`, stored through `Frame_SetPosition`.
4. If `Δv` is exactly zero on all three axes, each velocity component with `-0.0001 < v < 0.0001` (`0x004b0b70` = `0x38d1b717`) becomes 0. The position already moved with the old velocity.
5. `v = Δv + v`, stored.
6. `θ = ω · t` per axis, stored. Rows 0 (`A`) and 2 (`B`) of the rotation become `A + θ × A` with the operand order `(a.x - a.y·θz) + a.z·θy`, `(a.x·θz + a.y) - a.z·θx`, `(a.z - a.x·θy) + a.y·θx`, each stored, and go to `Frame_SetAxes`: normalize `A`; `d = (B.y·A.y + A.z·B.z) + A.x·B.x`; `B' = normalize(B - d·A)` (`d·A.x`, `d·A.y` stored, `d·A.z` not); row 1 = `B' × A`.
7. `L = (t · τ) + L` per axis (`t·τx` kept on the stack, `τy·t` and `τz·t` stored).
8. If `τ` is exactly zero on all three axes and `(θz² + θy²) + θx² < 0.0006` (`0x004b0b74`), `ω` and `L` become zero.
9. `F` and `τ` are cleared.

The world inverse inertia is not refreshed here; `RigidBody_Step` calls `0x00440a60` after the other updates.

## Maths helpers

| Address      | Name                                          | Port                                | Notes                                                                                                                    |
| ------------ | --------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `0x00449170` | `Math_SinCos`                                 | `getSineCosine`                     | One `FSINCOS`; both results stored                                                                                       |
| `0x00449190` | `Math_MultiplyMatrix3`                        | `getMatrixProduct`                  | Each element `(p + q) + r` summed on the stack, stored once; which term comes last: `0,0,0 / 0,1,1 / 0,1,0` (by element) |
| `0x00449280` | `Math_NormalizeVector2`                       | `getNormalizedVector2`              | `1 / sqrt(x² + y²)` kept on the stack; zero test is `FCOM double ptr [0x004b0df0]`                                       |
| `0x004492d0` | `Math_NormalizeVector3`                       | `getNormalizedVector3`              | `sqrt((x² + y²) + z²)`; same zero test; a NaN length also gives zero (unordered counts as equal)                         |
| `0x00449340` | `Math_QuaternionToMatrix`                     | `getMatrixFromQuaternion`           | Quaternion stored `x, y, z, w`; scale `2 / (((w² + z²) + y²) + x²)`; `s·z` and `z·s·z` are the values not stored         |
| `0x00449460` | `Math_MatrixToQuaternion`                     | `getQuaternionFromMatrix`           | Trace `(m4 + m8) + m0`; `m4 + m8` is also stored and the x branch reuses the stored copy                                 |
| `0x004495e0` | `Math_BlendQuaternions`                       | `getBlendedQuaternion`              | Dot `((y + z) + w) + x`; `> 0`: `(b - a)·t + a`, else `a - (a + b)·t`; not normalized                                    |
| `0x004496a0` | `Math_RotateVectorAroundAxis`                 | `getVectorRotatedAroundAxis`        | `FSIN` result kept on the stack, `FCOS` result stored; five of the nine matrix terms are not stored                      |
| `0x00410900` | `Frame_SetAxes`                               | `getRotationFromFrameAxes`          | See integrator step 6                                                                                                    |
| `0x00410f30` | `Frame_GetMatrixInFrame`                      | `getMatrixInFrame`                  | `transpose(R) · M` with last terms `0,0,0 / 0,1,1 / 0,1,1`, stored, then `Math_MultiplyMatrix3(·, R)`                    |
| `0x00440b10` | `RigidBody_AddForce`                          | `addForce`                          |                                                                                                                          |
| `0x00440b50` | `RigidBody_AddTorqueOfForceAtPoint`           | `addTorqueOfForceAtPoint`           | `(point - worldCentreOfMass) × force`; the z component is not stored before it is added                                  |
| `0x00440da0` | `RigidBody_RemoveAngularMomentumAlongAxis`    | `removeAngularMomentumAlongAxis`    | `L - ((L·a) a)`; dot `(Lz·az + Ly·ay) + Lx·ax`                                                                           |
| `0x00440cb0` | `RigidBody_RemoveAngularMomentumAgainstForce` | `removeAngularMomentumAgainstForce` | Removes `L` along `normalize(r × F)` when `L` points that way                                                            |

`FSIN`, `FCOS` and `FSINCOS` appear in `0x00449170` and `0x004496a0` here (and in about 40 functions overall, see game-map.md).

**Correction to game-map.md "Numerics"**: `0x00449291` and `0x004492f3` compare with a `qword` (double) memory operand, the 0.0 at `0x004b0df0`. It is only a comparison with zero, so the float32-only conclusion stands.

## Precision policy

The x87 precision while a race runs is unknown (game-map.md, Numerics). Every ported function takes a `FloatArithmetic` from `createFloatArithmetic(precision)`, and `RACE_FPU_PRECISION` chooses the precision in one place:

- `FpuPrecision.SINGLE` (24-bit, `DDSCL_FPUSETUP`): every `add`, `subtract`, `multiply`, `divide` and `getSquareRoot` result is rounded to a 24-bit significand. Because a double holds the exact product of two float32 values and has more than 2·24 + 2 bits, one rounding of the double result equals the x87's single rounding for these operations. Precision control narrows the significand only: the x87 keeps its 15-bit exponent, so an intermediate beyond float32's range neither overflows nor turns denormal until it is stored. Outside the float32 range the rounding scales by a power of two first (`roundToSignificand24`). Found by the emulator differential tests: before this, the port overflowed or flushed such intermediates and differed from the original (see [emulator.md](emulator.md)).
- `FpuPrecision.DOUBLE` (53-bit, the CRT default `0x004a87f8`): operations stay in doubles, which match x87 53-bit results.
- In both, `storeFloat` (`Math.fround`) is applied exactly where the code stores to a float32, and nowhere else.
- `getSine`/`getCosine` are never rounded: precision control does not apply to `FSIN`, `FCOS` and `FSINCOS`.

The default is `SINGLE`. Tests pin both precisions where they agree and show one case where they do not (`getNormalizedVector3({1, 2, 3})`: z is `0x3f4d41b2` in single, `0x3f4d41b3` in double).

## Open questions

1. **FPU precision during a race.** Read the control word in a debugger or emulator during a race; then fix `RACE_FPU_PRECISION`. Everything below depends on it only when rounding lands on a float32 boundary.
2. ~~**Exponent range.**~~ Resolved: single precision now keeps the 15-bit exponent (see the precision policy above); the emulator differential tests confirm it bit for bit.
3. **Transcendentals.** `FSIN`/`FCOS` return 64-bit-mantissa results with the x87's own argument reduction; `Math.sin`/`Math.cos` are double-accurate. A stored float32 result can differ when the true value lies within a double ulp of a float32 rounding boundary. In single precision, an unstored sine (`0x004496a0`) multiplied by a float32 is rounded twice in the port (53 then 24 bits) but once on the x87.
4. **Resolved** (`RigidBody_Step`): the spin branch does shorten the sub-step to the yaw timer's value; the `_ftol` argument of `0x004478b0` is step × the winning contact's fraction; `+0x36c` == 4 means three or more wheels down (the body is aligned to row 2), not all four; the body moves its own embedded frame `+0xe4`.
5. **The car body's slots `+0x0c` and `+0x10`** (`0x0042a830`, `0x0042a900`): they read the material's property object (`+0x14`, flags `0x8`, `0x10000` pass-through, `0x40000`), call checkpoint and event code for digit-named materials, and write the wheels' surface values `+0x50..+0x6c`. Not ported; until they are, every hull contact is accepted and the surface values stay as the racer sets them.
6. **Two-point mode** (flag `0x8`, slot 12 `0x00448660`): `0x00448840`, `0x004464a0`, `0x004465c0` and the flag-`0x8` branch of the forces are not ported; `stepCarRigidBody` throws `TwoPointModeNotPortedError`. What sets the flag in a race is not traced.
7. **Mirrored races**: `0x00411040` mirrors each BVB instance's frame as well; only the volume mirror is ported.

## Ported and not ported

Ported, with tests:

- `Race_Update` time step (1.75× flag, `_ftol`) and the 40 ms sub-step split; the loop that runs one sub-step per piece.
- `Math_SinCos`, `Math_MultiplyMatrix3`, `Math_NormalizeVector2`, `Math_NormalizeVector3`, `Math_QuaternionToMatrix`, `Math_MatrixToQuaternion`, `Math_BlendQuaternions`, `Math_RotateVectorAroundAxis`.
- `Frame_GetAxes`, `Frame_SetAxes`, `Frame_GetMatrixInFrame` (as pure functions on a rotation matrix).
- `BoxRigidBody_ComputeInertia`, `RigidBody_Attach` (as `createBoxRigidBody`), `RigidBody_UpdateWorldInverseInertia`, `RigidBody_UpdateAngularVelocity`, `RigidBody_AddForce`, `RigidBody_AddTorqueOfForceAtPoint`, `RigidBody_RemoveAngularMomentumAlongAxis`, `RigidBody_Integrate`.
- `RigidBody_Step` (`0x00444ef0`) as `stepCarRigidBody`: timers, forces (`0x00445500`), `0x00445c30`, `0x00445d10`, ground probes (`0x00445dc0`, `0x00448430`, `0x00448a50`, `0x00448a70`, `0x00448ae0`, `0x00448c70`, `0x00448d90`), heading (`0x00446fd0`, `0x00447230`), `0x00447330`, `0x004474c0`, `0x00447690`, `0x00447880`, hull contacts (`0x004478b0`, `0x00447cf0`), `0x00448070`, the lean (`0x004452b0`), the car rigid body's slots 2–21 that a step or a racer needs (`0x004482e0`, `0x00448820`, `0x00448370`, `0x00448390`, `0x004483b0`, `0x004480c0`, `0x00448110`, `0x00448760`–`0x004487f0`, `0x00448800`), `0x00449070`, `0x00449090`, the constructor defaults (`0x00444b40`) and setup (`0x00444d90`, `0x00446e60`, `0x00446ea0`, `0x00441190`).
- `RigidBody_RemoveAngularMomentumAgainstForce` (`0x00440cb0`), `RigidBody_AddAngularVelocity` (`0x00440bd0`), the frame transforms (`0x00410c80`, `0x00410cf0`, `0x00410d60`, `0x00410de0`) and axis builders (`0x00410a00`, `0x00410b00`), and the world centre of mass update.
- The collision queries (`collision` module, [collision.md](collision.md)).

Not ported:

- The two-point mode (`0x00448840`, `0x004464a0`, `0x004465c0`, and its branches in `0x00445500`), the spin commands (slots 9–11: `0x00448160`, `0x00448290` is in `racer`), the sound objects, the car body's slot `+0x0c` and `+0x10` overrides, the frame's bounding sphere (the probe height takes `displayBoundingRadius` as given).
- `Camera_Update`, `GhostRecorder_RecordSample` and the rest of `Race_Update` around the sub-step loop.
