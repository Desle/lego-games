# Racer update: `RacerSet_Step`, the driver, the car body and the player controls

Source: `LEGORacers.exe` (English, 1999-07-22). Every rule comes from the disassembly (`DisassembleRange.java`); float order, stores and comparisons were read from the x87 code, not the decompiler. Anything not proven by code is marked **hypothesis**. The port is `packages/lego-racers/src/modules/racer`; names are in `reverse-engineering/names/LEGORacers.exe.txt`. The rigid body under the car body is in [physics.md](physics.md).

x87 comparisons below: `FCOM`, `TEST AH,0x41` / `JNZ` jumps when the stack top is below, equal or unordered; `TEST AH,0x1` / `JZ` jumps when it is not below; `TEST AH,0x40` / `JZ` when not equal. The port uses `getIsBelow`, `getIsBelowOrEqual` and `getIsEqual`, which count unordered as true like the x87.

## Lookup tables

| Address      | Content                                                                                       | Port                  |
| ------------ | --------------------------------------------------------------------------------------------- | --------------------- |
| `0x004befec` | 1,024 `uint16` values in 0–1023 (not a permutation), read with the global cursor `0x004c6ee4` | `random-table` module |
| `0x004bf7ec` | 1,024 `float32`: `cos(i · 2π / 1024)` as stored by the game (`[0] = 1.0`, `[256] = 0.0`)      | `getTableCosine`      |
| `0x004c4810` | `float32` set once at start-up by `0x0041fb30` to `54 · 8` = 432 (driver full throttle)       | `FULL_THROTTLE`       |
| `0x004c67a8` | `float32` set once by `0x0043ae20` to `200²` (nearest-racer sound range, pass 8)              | audio, not modelled   |

`readRacerTables` reads both from the player's `LEGORacers.exe`: the random table through the `random-table` module (`loadRandomTable`), the cosine table through its `readPortableExecutableBytes`. Every draw in this module uses `random-table`'s `drawRandomValue` on `RacerSet.randomPosition`.

## Player controls

### Bindings: `PlayerController_OnBindingPressed` (`0x004309c0`)

The player controller (race `+0x258`, stride `0x74`, constructor `0x00430020`) has nine bindings set up by `Race_AcquireControllers` (`0x004343e0`, `0x004308f0` per binding). The device callback `0x004309c0` matches a device event against the nine bindings and calls the binding's handler with 1; `0x00430c20` calls all nine with 0. Each handler sets or clears one bit of controller `+0x5c`:

| Binding | Handler      | Bit     | Press                                                                                           | Release           |
| ------- | ------------ | ------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| 0       | `0x00430570` | `0x1`   | steer towards positive steering                                                                 |                   |
| 1       | `0x00430590` | `0x2`   | steer towards negative steering                                                                 |                   |
| 2       | `0x004305b0` | `0x4`   | accelerate; then `0x00430790` (start boost)                                                     | `+0x68 = 0`       |
| 3       | `0x004305e0` | `0x8`   | brake; first, if car body `+0x6c0 & 2`, car body slot 10 (`0x00448290`)                         |                   |
| 4       | `0x00430620` | `0x10`  | use power-up `0x00439100`; the whole handler is skipped while `+0x60 & 3`                       |                   |
| 5       | `0x00430650` | `0x20`  | `0x0043a390`: camera (racer `+0xdb4`) cycles `+0xdb8 = (+0xdb8 + 1) & 3`, then the bit          |                   |
| 6       | `0x00430680` | `0x40`  | `0x0043a0c0`: HUD (racer `+0xe30`, set by `0x004262c0`) `+0x3c = (+0x3c + 1) & 3`, then the bit |                   |
| 7       | `0x004306b0` | `0x80`  | power slide (read by `0x00430390`)                                                              |                   |
| 8       | `0x004306d0` | `0x100` | `0x0043a3f0`: camera `+0x04 = 1` (**hypothesis**: look behind)                                  | `0x0043a400`: `0` |

The names of bindings 0, 1 and 8 describe their effect, not the game's menu text. `RacerControls` is a per-frame snapshot of the nine bindings and two axes; `applyRacerControls` calls the press or release handler, in binding order, for each binding whose state changed. The original calls them per device event, before `Race_Update` (events are handled at the top of `Race_RunLoop`), so a press and release inside one frame are not seen by the port.

Controller fields: `+0x5c` binding bits, `+0x60` state (`0x1` before the start, `0x2` controls off — set by `0x00430760` when a player finishes, `0x8` accelerating), `+0x64` start boost window (uint32 ms), `+0x68` milliseconds accelerate is held, `+0x6c` steering (float32), `+0x70` throttle axis enabled (set by `0x004307f0` for a device named `"Microsoft SideWinder Force Feedback..."`).

### `PlayerController_Update` (`0x00430530`, thiscall: frame milliseconds)

Called by `Race_Update` once per frame with the whole frame time (not per sub-step): `+0x64` counts down to 0 (`JNC`: 0 when the step is larger), `+0x68 += step`, then `0x00430120` and `0x00430390`.

### Steering, `PlayerController_UpdateSteering` (`0x00430120`)

`t = float32((float)ms · 0.001)` (`0x004af220`). Limits start at `upper = 1.0`, `lower = -1.0` (`0x004b0754`). The rate is, with the racer power-sliding (`+0xd04 & 0x80`): 16 (`0x004b0750`) if driver `+0x30` (racer `+0xca0`) is 1, else 5 (`0x004b074c`); otherwise 1.25 (`0x004b0744`) with a steering bit held and 2.5 (`0x004b0740`) without.

- Digital (bits `0x3` not both clear): only bit 1 → speed 8.25 (`0x004b0748`) if steering < 0, else the rate; only bit 2 → −8.25 if steering > 0, else −rate; both → recentre.
- Analog: `a = −axis1` (the device's slot `+0x30` result, negated), clamped to [−1, 1]. `a > 0`: `upper = float32(a)`, speed 8.25 if steering < 0, else `((1 − a) · 0.5 + 0.5) · rate`. `a < 0`: `lower = float32(a)`, speed −8.25 if steering > 0, else `((a + 1) · 0.5 + 0.5) · −rate`. `a = 0`: recentre.
- A zero speed also recentres. Recentre: steering > 0 → speed −8.25, `lower = 0`; < 0 → speed 8.25, `upper = 0`; 0 → speed 0, both limits 0.
- `new = speed · t + steering`; `FCOM upper` on the unrounded value, `FST` stores it; above `upper` → `upper`, else below `lower` → `lower`.
- Unless `+0x60 & 3`, `RacerDriver_SetSteering` (`0x0041fe60`) with the new steering.

### Throttle and power slide (`0x00430390`)

`accelerate = 0`, `brake = 0`; with `+0x70`, `v = −axis2`: `v < 0` → `brake = v`, else `accelerate = v` (both `FSTP float`). Bit `0x4` → `accelerate = 1.0`; bit `0x8` → `brake = −1.0`. `sum = float32(accelerate + brake)`: `> 0` → `0x00430790`; `< 0` → `+0x68 = 0`. `+0x60` bit 8 = `accelerate > 0`.

With `accelerate > 0` and bit `0x80`: unless `+0x60 & 3`, `sum = 1.0`, then steering = 0 → `Racer_StopPowerSlide` (`0x00439870`); else if not sliding → `Racer_StartPowerSlide` (`0x004397c0`) with 1 when `brake < 0`, else 0. Without both: a sliding racer stops. Then if the racer is not sliding, `brake < 0` and `accelerate > 0`, `sum = 0.5` (`0x004b0758`). Unless `+0x60 & 3`, `RacerDriver_SetThrottle` (`0x00420130`) with `sum`.

### Start boost (`0x00430790`)

Before the start (`+0x60 & 1`): after more than 2,000 ms of accelerate, `+0x64 = 100`, `+0x68 = 0`. After it: with `+0x64 ≠ 0` and `+0x60 & 3` clear, power-ups `0x0045b1e0(racer, +0x64 > 59)` and smoke `0x0043df90`, then `+0x64 = 0`. At the start, `0x00430710` (race state 2) clears bit 1 and either fires the same power-up call or opens the window when accelerate is not held; it is not ported.

## Racer power slide

- `Racer_StartPowerSlide` (`0x004397c0`, direction): skipped when already sliding (`+0xd04 & 0x80`) in the same direction (driver `+0x30`). Otherwise `RacerDriver_StartPowerSlide`; if the driver's flag `0x4` got set, racer `+0xd04 |= 0x80`, and for a player (`+0xd08 == 0`) without car body `+0x6c0 & 8` the vehicle dust and skid effects (`0x0043def0`, `0x0043dc00`) and sound `0x39` (presentation).
- `Racer_StopPowerSlide` (`0x00439870`): only when sliding: `RacerDriver_StopPowerSlide` if driver flag `0x4`; without car body `+0x6c0 & 8`, sound `0x41` and `0x0043dcd0` (presentation); then clears `0x80`.

## Driver (racer `+0xc70`, constructor `0x0041fb50` → `0x0041fb80`, all fields 0)

| Offset         | Type   | Meaning (port field)                                                                                                                                                              |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x00`        | ptr    | The car body (set by `0x0041fbd0` from `0x004371c0`)                                                                                                                              |
| `+0x04`        | float  | Route time (`routeTime`), used by route following                                                                                                                                 |
| `+0x08`        | float  | Previous curvature (`previousCurvature`)                                                                                                                                          |
| `+0x0c`        | float  | Curvature asked for (`curvature`)                                                                                                                                                 |
| `+0x10`        | float  | Throttle force (`throttle`)                                                                                                                                                       |
| `+0x14`        | uint32 | Flags (`flags`): `0x1` full throttle, `0x2` hold (cleared every update), `0x4` power slide, `0x8` slide boost, `0x10` wobble, `0x20`, `0x40` on a route, `0x80` no route, `0x100` |
| `+0x18`        | float  | Wobble steering (`wobbleSteering`)                                                                                                                                                |
| `+0x1c`        | float  | Wobble throttle (`wobbleThrottle`)                                                                                                                                                |
| `+0x20`        | uint32 | Milliseconds to the next wobble (`wobbleMilliseconds`)                                                                                                                            |
| `+0x24`        | uint32 | Route step (`routeStepMilliseconds`)                                                                                                                                              |
| `+0x28`        | uint32 | Standing-still time on a route (`stuckMilliseconds`, `0x0041fdb0`)                                                                                                                |
| `+0x2c`        | uint32 | Slide time (`slideMilliseconds`)                                                                                                                                                  |
| `+0x30`        | uint32 | Power slide direction (`slideDirection`)                                                                                                                                          |
| `+0x34..+0x4c` | —      | Route sample copied from the route object `+0x50` (not modelled)                                                                                                                  |

- `RacerDriver_SetSteering` (`0x0041fe60`, s): `s = −s` with flag `0x10`; `k = s · body+0x728`; `q = float32((0.025 − 0.00025) · k)` (`0x004b005c`, `0x004b0060`, subtracted at run time); `k > 0` → `+0x0c = float32(1 / (0.00025 + q))`, `k < 0` → `float32(1 / (q − 0.00025))`, else 0. Full steering with scale 1 gives exactly 40.
- `RacerDriver_SetThrottle` (`0x00420130`, v): with flag `0x10`, `v += +0x1c` (not stored), clamped to ±1. `+0x10 = float32(54 · v)` (`0x004b0064`), times 2 (`0x004b0068`) when braking: `v < 0` with forward speed (body `+0x618`) > 0, or `v > 0` with forward speed < 0.
- `RacerDriver_Update` (`0x0041fc00`, step): flags `&= ~2`; `+0x08 = +0x0c`. If `step > +0x20` (unsigned): with flag `0x10`, three draws: `+0x20 = r % 500`, `+0x18 = float32((r % 400) · 0.01 − 2.0)`, `+0x1c = float32((r % 200) · 0.01 − 1.0)` (`0x004af668`, `0x004b009c`); without it nothing (the timer is not reset). Else `+0x20 −= step`. Then flag `0x4`: forward speed < 0.03 (`0x004b0080`) → `+0x2c = 0`, `RacerDriver_StopPowerSlide`; else `+0x2c += step`. Else flag `0x8`: `+0x2c += step`, at 300 or more clear `0x8` and `+0x2c`. Flag `0x1` with body `+0x3ec ≠ 0` sets `0x100`. Then `0x0041fee0` and `0x004201e0`.
- `RacerDriver_UpdateWithoutRoute` (`0x0041fd60`): `+0x10 = float32(−(54 + 54))` when forward speed > 0, else 0; then `0x0041fee0`, `0x004201e0`.
- `RacerDriver_ApplySteering` (`0x0041fee0`): both curvatures exactly 0 → body steering 0, `+0x08 = 0`, `CarRigidBody_StopSlide`. Else, a non-zero curvature below speed 0.04 (`0x004b006c`, body `+0x604`) is scaled by 0.2 (`0x004b0070`) and stored; `a = |c|` (stored).
  - Flag `0x4`: if `CarBody_GetIsAbleToSlide(c)` and `a > 0`: `m = float32(max curvature)`; `x = 1 − a/m`, at least 0.05 (`0x004b007c`); driver `+0x30 == 1` → `x = x + x`, damping 0.25, else damping 0.85 (`0x3f59999a`); `CarRigidBody_StartSlide(float32(x + 1), damping, π)`; if `a < m`, `c = float32(±((m − a) · 0.5 · 0.5 + a))`. Otherwise stop the slide and set the steering.
  - Flag `0x2`: keep `c`.
  - Neither: `m = float32(max curvature)` (through the thunk `0x0042ae10`); able to slide and `0 < a < m` → `StartSlide(float32((1 − a/m) + 1), 0.85, 0.70710677 (0x3f350481))`, else stop the slide; if `a < m`, `c = float32(±((m + a) · 0.5))`.
  - Then `CarRigidBody_SetSteering(c)` with the driver's `+0x0c`.
- `RacerDriver_ApplyThrottle` (`0x004201e0`): flag `0x8` and `+0x10 > 0` → `+0x10 = float32(+0x10 · 8)` (`0x004b0098`). Flag `0x1` → car body slot 5 with 432, or `float32(432 · 0.5)` with flag `0x100`; else flag `0x2` → `float32(+0x10 · 1.0)`; else `+0x10`.
- `RacerDriver_StartPowerSlide` (`0x00420260`, d): clears `0x8`; if `CarBody_GetIsAbleToPowerSlide`: `+0x2c = 0`, flag `0x4`, `+0x30 = d`, `CarRigidBody_StartPowerSlide(d == 0 ? 0.3 : 0.4)`.
- `RacerDriver_StopPowerSlide` (`0x004202c0`): clears `0x4` and `0x8`, `+0x2c = 0`, `CarRigidBody_StopSlide`, `CarRigidBody_StopPowerSlide`.

## Car body (racer `+0x3e8`)

Fields the racer code uses, on top of the rigid body of physics.md (car body offsets; racer offset = car body + `0x3e8`):

| Offset             | Type             | Meaning (port field)                                                                                                                                                  |
| ------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0xdc`            | float            | `fadeFactor`: 1.0 after `0x00441210`; written by pass 7 (racer `+0x4c4`)                                                                                              |
| `+0xe4`            | frame            | Physics frame (rotation `+0x10c`, position `+0x130`)                                                                                                                  |
| `+0x13c`           | ptr              | Display frame (`displayFrame`) = racer `+0x5c`, set by `CarRigidBody_Attach` (`0x00444d90`); `0x004452b0` copies the physics frame into it, tilted by the power slide |
| `+0x15c`           | float            | `scaledMass` = attach mass · 0.001 · 0.001                                                                                                                            |
| `+0x160`           | float            | `gravity` (**hypothesis**)                                                                                                                                            |
| `+0x168..+0x170`   | vec3             | `restingForward`: row 0 at attach                                                                                                                                     |
| `+0x198`           | 4 × 0x70         | Wheels: `+0x48` bit 0 touching, `+0x5c` grip (`wheels`)                                                                                                               |
| `+0x36c`           | uint32           | Wheels on the ground (`groundedWheelCount`)                                                                                                                           |
| `+0x3ec`           | uint32           | World contact (`contact`)                                                                                                                                             |
| `+0x5e0..+0x5e8`   | uint32           | Timers folded by `0x00448290`                                                                                                                                         |
| `+0x5ec`           | float            | `driveFactor` (`0x004483b0`)                                                                                                                                          |
| `+0x5f4`           | float            | `gripScale`                                                                                                                                                           |
| `+0x5f8..+0x600`   | vec3             | `travelDirection`                                                                                                                                                     |
| `+0x604`           | float            | `speed`; `+0x608` `wheelRadius` (**hypothesis**); `+0x618` `forwardSpeed`; `+0x628` `throttle`; `+0x64c` `steering`                                                   |
| `+0x6c0`           | uint32           | Flags: `0x1` sliding, `0x2`, `0x8`, `0x80`, `0x200`, `0x400` power slide, `0x10000`, `0x40000`                                                                        |
| `+0x6c4..+0x6d0`   | float            | Slide strength, cosine of the slide phase, rate, damping                                                                                                              |
| `+0x6d8`           | float            | `powerSlideFactor`                                                                                                                                                    |
| `+0x6f0`           | ptr              | The racer                                                                                                                                                             |
| `+0x700`, `+0x70c` | vec3, quaternion | Last safe position and orientation (`safePosition`, `safeOrientation`)                                                                                                |
| `+0x728`, `+0x72c` | float            | Steering and throttle scales                                                                                                                                          |
| `+0x738..+0x740`   | —                | Engine sound: run time, sound id, sound object (only `CarBody_Update` and `0x0042b060` use them)                                                                      |
| `+0x744`           | uint32           | Scripted (`isScripted`)                                                                                                                                               |
| `+0x778`           | float            | Route speed factor (`speedFactor`)                                                                                                                                    |
| `+0x7e8`, `+0x7ec` | float            | Default and current target speed factors, 1.0 after `CarBody_Reset` (`0x00429120`); set by the rubber band                                                            |

Car rigid body helpers (port: `car-body.ts`):

- `CarRigidBody_SetSteering` (`0x00446ef0`): `(0, 40)` → 40 (`0x004b0cd0`), `[40, 4096]` kept (`0x004b0cd4`), above 4096 → 0; the same mirrored below 0; 0 → 0.
- `CarRigidBody_StartSlide` (`0x00447f30`, strength, damping, rate): `+0x6c4`, `+0x6d0`, `+0x6cc`, flag `0x1`; `+0x6c8 = cosine[_ftol(rate · 162.97466) & 0x3ff]` (`0x004b0b48` = 1024 / 2π). A skid sound (`0x3a`) starts under conditions; not modelled.
- `CarRigidBody_StopSlide` (`0x00448070`): `+0x6c8 = −1.0`, `+0x6cc = π`, flags `&= ~0x201`, skid sound stopped.
- `CarRigidBody_StartPowerSlide` (`0x00449070`, f): flag `0x400`, `+0x6d8 = f`. `CarRigidBody_StopPowerSlide` (`0x00449090`): clears it, `+0x6d8 = 0.2` (`0x004b0d80`).
- `CarRigidBody_GetAverageGrip` (`0x004489f0`): sum of `+0x5c` of touching wheels (stack), `/ count · +0x5f4`; 0 when none.
- `CarRigidBody_GetMaximumCurvature` (`0x00445cb0`): `p = (+0x160 · +0x15c) · grip`; `p == 0` → 100 (`0x004b0d88`) airborne, else 4096; otherwise `((v · v) · mass) / p` with `v = +0x618`. Not stored.
- `CarBody_GetIsAbleToSlide` (`0x0042aea0`, c): `d = (t.z·r.z + t.y·r.y) + t.x·r.x` (t = `+0x5f8`, r = display row 0), `FST` copy; `d ≤ 0` → no; `c < 0` with steering > 0, or `c > 0` with steering < 0 → no; without flag `0x1` the stored `d` must be ≥ 0.9 (`0x004b0554`); no contact; speed ≤ 0.155 (`0x004b0470`).
- `CarBody_GetIsAbleToPowerSlide` (`0x0042ae20`): no contact; flag `0x8` or at least 3 wheels down; unrounded `d > 0.85` (`0x004b0550`); forward speed ≥ 0.05 (`0x004b046c`).
- Car body slot 5 `CarBody_SetThrottle` (`0x0042ad30`): `CarRigidBody_SetThrottle(float32(+0x72c · v))` (`0x00448370`): `+0x628`, then `0x004483b0`: `+0x5ec = float32((mass · |t|) / (r · r))`, 0 for 0.
- Car body slot 10 `CarRigidBody_FoldSpinTimer` (`0x00448290`): with `+0x5e4 ≠ 0`, subtract `+0x5e8` while larger, then `+0x5e0 = +0x5e4`, `+0x5e4 = +0x5e8 = 0`. A zero period with a larger pending time never ends; the port throws.

### `CarBody_Update` (`0x004293f0`, slot 1)

1. `+0x744 ≠ 0` → `CarBody_StepOnRoute` (`0x00429d40`, computer racers, see ai.md); else `RigidBody_Step` (`0x00444ef0`), then:
   - all four wheels down (`+0x36c == 4`), no contact, and not (racer `+0xd04` has both `0x400` and `0x2`): `+0x700` = frame position (slot 1), `+0x70c = Math_MatrixToQuaternion(+0x10c)`.
   - position z below −250 (`0x004b04dc`) or above 340 (`0x004b04d8`): `Frame_SetPosition(+0x700)`, `Math_QuaternionToMatrix(+0x70c → +0x10c)`, velocity and angular momentum zeroed.
   - racer flags `0x400` and `0x2` both set (**hypothesis**: reset to the safe pose): the same restore.
2. Engine sound, with a sound object at `+0x740`: wheels down, `+0x6c0 & 8` clear and |speed| ≥ 0.009 → `+0x738 += step` and the sound's position, velocity, pitch `clamp(speed / 0.22 + 0.4, 0.5, 2)` and volume `min(+0x738 / 280, 1)`; else `0x0042b060` releases it. Audio only.

## `RacerSet_Step` (`0x0043c030`, thiscall on race `+0x3bc`: step)

| Pass | Code                                                                                                                                                             | Port                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | Driver: `+0x14 & 0x80` → `0x0041fd60`; else `+0xd08 == 2` → `0x004203b0` if `+0x14 & 0x40`; else `0x0041fc00`                                                    | Ported, incl. `followDriverRoute` (`0x004203b0`)                          |
| 2    | `CarBody_Update`                                                                                                                                                 | Ported around `stepRigidBody`, `stepScriptedCarBody`, `updateEngineSound` |
| 3    | Racers with `+0xd04 & 0x80`: `0x00437b50`                                                                                                                        | Ported; `endPowerSlideEffects`                                            |
| 4    | Racer set `+0xf0` (constructor `0x0043d150`, vtable `0x004b0aa8`) slot 4 = `0x0043d180`: sorts bodies along an axis and tests pairs (`0x0043aa10`, `0x00441330`) | `collideRacers` (racer list, registry stage); `racer-collision`           |
| 5    | `0x00437740`                                                                                                                                                     | `updateVehicle`                                                           |
| 6    | `0x00437d40`, `0x00437be0`                                                                                                                                       | `updateRacerSounds`                                                       |
| 7    | `0x004377f0`                                                                                                                                                     | Ported with seven dependencies                                            |
| 8    | `0x0043c1b0`                                                                                                                                                     | Ranking ported; `updateNearestRacerSound`                                 |
| 9    | `0x0043a480` on racer set `+0x284`                                                                                                                               | Ported                                                                    |

### Pass 3: `0x00437b50`

Without driver flag `0x4` → `Racer_StopPowerSlide`. Otherwise `racer+0x3b4 (vehicle +0x39c) = float32(±(1 − ((f.z·r.z + f.y·r.y) + f.x·r.x)) · 0.06 + +0x3b4)` with `f` = body `+0x168`, `r` = display row 0, negated when the steering `+0x64c` < 0 (`0x004b09cc` = 0.06).

### Pass 4: `0x0043d180` (collision manager, racer set `+0xf0`, vtable `0x004b0aa8`)

Body: `0x0043d200`, `0x0043aa10` (timers `0x0042fc10`, sort `0x0043aca0`, sweep `0x0043ab90`), `0x0043d3f0`, `0x0043d270`, `0x0043d200`. Node (0x2c bytes): `+0` listener, `+4` type, `+8` flags, `+0xc` max count, `+0x10` interval, `+0x14` shape, `+0x18` previous, `+0x1c` count, `+0x20` ticks, `+0x24` active, `+0x28` next. Manager: free list `+8`, timers `+0xc`, racer nodes `+0x2c` (prepended on add, so the list starts in reverse racer order: `collisionOrder`), registry nodes `+0x48`.

- **Timers** (`0x00438e60` period 750 ms): a running kick timer counts up by the step; at 750 ms or more `endRacerKick` clears it.
- **Sort** (`0x0043aca0`): insertion sort of list `+0x2c` by the sphere's lowest x (`centre.x - r`, stored), recomputed with x87 compares at every comparison (`getIsBelow` to move, `getIsBelowOrEqual` to place; equal keys stay in order). The sphere is the display figure's bounds (`0x0040e0b0` through `0x004113c0`) moved by the display frame; a figure without a model part has radius 0 at the origin.
- **Sweep** (`0x0043ab90`/`0x0043ab10`): for each node, the following nodes whose lowest x is at most its highest x; sphere test `0x00411b90` (`D = (dz² + dy²) + dx²`; `FLT_MAX` or NaN is no overlap; `D < (r1 + r2)²`); box test `0x00441790` (SAT over 15 axes, edge axes epsilon ±0.001, scale `+0xdc`) and contact `0x00441330` (mean of the corners that pass); a contact with depth ≠ 0 calls the first node's listener `0x00438560` (node flags 5: no reciprocal call).
- **Response** `0x00438560` (types 1 and 3): impulse along the normal from the relative velocity, inertia and `+0xcc` inverse masses; the car body commands slot 8 `0x00429770`/`0x00448110`, slot 9 `0x00429c40`/`0x00448160`, slots 16 to 19 `0x004298a0`, `0x004298d0`, `0x004298f0`, `0x00429920` (scripted bodies move the route speed factor through racer-ai's `getPushedSpeedState`/`getRestoredSpeedState`); kick `0x00438e60`, attack, spark emitter (presentation); draws from the random table as in the code; `moveOutOfContact` is `0x004490b0`.
- **Registry** (`0x0043d270`): racers in list order against the entries of list `+0x48` along x, by projectiles' `getRegistryContacts`/`getSortedRegistryEntries` (one copy, in `projectiles`). `RacerSet.registryEntries` holds the entries and `registryContacts` the contacts of the last pass; whoever registers an entry answers them. The precise volume test (slot 6, `+0x18`) is the dependency `getIsTouchingRegistryEntry` (default: no touch). Every racer node is taken as active; whether racer `+0xe0` can be 0 is not checked.

Differential tests against the emulator: `0x00441790`/`0x00441330`, `0x00411b90`, `0x00438560` (400 cases per precision, with cursor and timers), the car body commands, `0x004490b0`, `0x0040e0b0`/`0x0040dd60`, the manager (300 cases), `0x00439cf0`/`0x00439ea0`, `0x00422100`.

### Figure (`0x0040d530` class, vtable `0x004af5ec`; racer `+0x5c`, car body `+0x13c`)

Flags `+0x5c`: `0x10000` plays, `0x20000` blends, `0x40000` loops, `0x80000` ended, `0x100000` chains, `0x400000` target loops, `0x2000000` wrapped. Child (model part) `+0x78`, animation set `+0xa8` (records of 0x28 bytes: rate, vector, bounds), ids `+0xbc`/`+0xd8`. Ported: `play` `0x0040dad0`, `blend` `0x0040db80` (300 ms), `update` `0x0040dd60`, wrap `0x00401150`, bounds `0x0040e0b0`.

### Pass 5: `0x00437740` and `Vehicle_Update` `0x0043e070`

Forward speed `+0x618` within ±0.0001 (`0x004b09c4`) counts as 0; reversing selects animation 1 (`0x004401e0`), else animation 0 (`0x004401b0`); the rate is `float32(|v| · 1.8)` (`0x004b01a4`), on the display figure and the vehicle's second figure; the display figure updates (`0x0043e740`'s sway of the model frame is presentation and not ported). Then the driver figure's choice `0x0043ec10` (differential tested against the emulator, 800 cases per precision): finished race celebrates (winner: one draw, odd plays `0xe` then `0xf`; others `0xb` then `0xc`), start boost animation 1, hit animation `0xa` with force feedback 500 then 9, braking from above 0.05 to below 0.01 stops with a voice (`0x00439240`) and animation 0, reversing 2, steering by the curvature 5/6, rest 9, and looking at the nearest racer within 200 (`0x0043cbb0`) after a draw. The effect emitters draw once for each live emitter; their particles are presentation and not ported.

### Route following: `0x004203b0` (pass 1, computer racer with driver flag `0x40`)

Driver fields: `+4` the route, `+0x24` route step (1000 after `0x004202f0`, +250 each retarget), `+0x28` stuck time, `+0x34..+0x3c` target position and `+0x40..+0x4c` target quaternion (copied from the follower), `+0x50` the follower. Within 3 units of the target (`0x004b0088`, the unrounded square root): `0x0042a730` (the car body follows the route: follower to the loop point, display frame = loop pose, centre of mass and hull points moved), `0x0042b0c0` (speed factor, targets 1; follower settled by `0x004a5750` with no displacement; offset and bounce 0), advance the car body's follower by the route step, `0x00420380` (the driver lets go: route, flag `0x40`, step, curvature, throttle 0; steering and throttle 0). Otherwise: `+8 = +0xc`, `0x0041fdb0` (below 0.009 speed for 1000 ms sets flag `0x20` for 2000 ms; a spinning body clears it), curvature `dist / (2 · proj)` with `proj` the target direction's component on the car's second axis (4096 below 0.0005, negated for a target on the far side), throttle 18 (`-54` with flag `0x20`, curvature negated); when the car is within 30 of the target or its heading is below 0.5 along the target's first axis, and within 80: retarget (`+0x24 += 250`, follower to the loop point and 250 ms ahead). Then `0x0041fee0` and `0x004201e0`.

`0x004a5750` (move the follower by a displacement) is ported for moves that end inside the current segment (always so for a zero displacement; differential tested, 1500 cases per precision); moves past either end of the segment (`0x004a5bc6`, `0x004a59ab`) throw `UnportableRouteError`. The route search `0x0043d070` is not ported: nothing sets driver flag `0x40` in a race yet; `assignDriverRoute` (`0x004202f0`) is exported for it and creates the follower, which the original has from the racer's creation. Unit tests only for `followDriverRoute` (the car body and display frame objects it calls through vtables are not built in the emulator).

### Pass 6: `0x00437d40`, `0x00437be0` (audio)

Only with `+0xd04 & 0x400`. Three engine loops (`+0xd9c`, `+0xda0`, `+0xda4`) cross-fade by `+0xd24` with volumes `+0xd28..+0xd30` and the cosine table; `+0xda8` a fourth; `0x00437be0` starts or stops four looped sounds `+0xd8c..+0xd98` from flags `0x40`, `0x10` and `+0xd68`. No random draws.

### Pass 7: `Racer_UpdateTimers` (`0x004377f0`, step)

Skipped with `+0xd04 & 0x2`. In order:

1. `+0xce4 < (uint8)+0xce0` → `+0xcec[+0xce4] += step` (lap time).
2. `+0xcd8 += step`; above `+0xcdc`: `+0xcd8 = 0`, `+0xcdc = 150`, and a computer with a power-up (`+0xccc`) runs `0x00438f20` (`considerComputerPowerUp`).
3. Car body `+0x6c0 & 0x80` with `+0x744 == 0` → `0x004397b0` (car body slot 15, `endCarBodyEffect`).
4. Countdowns to 0 (`JBE`: subtract when `step ≤ t`, else 0): `+0xd34`, `+0xd44`, `+0xd4c`; `+0xd50 += step` while no wheel is down, else 0; `+0xd74`; `+0xd7c` (when `step > t` and `+0xd04 & 0x800`: `0x00439b00`, `endTimedEffect`, which zeroes it; else nothing); `+0xd84`.
5. `+0xd48`: `step < t` and `+0xd04 & 0x10000000` → `t −= step`, body `+0xdc` = 0 if `t ≤ 500`, else `float32((t − 500) · 0.004)` (`0x004b01a8`); else `t = 0`, body `+0xdc = 1.0`. Then `0x10000000` is cleared.
6. `+0xe08` = display position, `+0xe20` = display row 0, `+0xe14` = body velocity.
7. `+0xd34 == 0` and a computer: `0x0043ca60(position, row 0, 0, 169, 0.3)`; found → `0x00439c90` (Racer_Taunt), draw `r`, `+0xd34 = r · 8 + 2000`; else `+0xd34 = 2000`.
8. A player (`+0xd08 == 0`): `0x00439cf0` (wrong way, flags `0x2000`/`0x4000`, `+0xd78`) and `0x00439ea0` (flags `0x10000`/`0x20000`); others: `+0xd78 = 0`, flags `&= ~0x6000`.
9. Contact (body `+0x3ec`): `0x00422100(+0x14)`; with `+0xd4c == 0` a draw picks sound `0x19` (odd) or `0x38`, `+0xd4c = 250`.
10. `+0xd04 & 0x8000000` without `0x8`: power-ups `0x0045b1e0(racer, 2)`.

### Pass 8: `RacerSet_RankRacers` (`0x0043c1b0`)

The static array `0x004c67b0` (stride 12: racer, distance, progress) is filled with `progress = float32(Racer_GetProgress)` (`0x0043a0a0`: `(float)+0xd18 + checkpoint+0x1c`, 0 without checkpoint `+0xcc4`).

1. Selection sort, ascending by progress (strict `<`, first wins); swaps move racer and progress, not the distance.
2. For each `i` from 0 to `n − 2`: the run of entries equal to entry `i` (`FCOMP`, `TEST AH,0x40`) ends at `e`; if `e > i + 1` and entry `i`'s racer has a checkpoint: each entry in `[i, e)` gets `distance` = the smallest of `((n.z·p.z + n.y·p.y) + p.x·n.x) + d` over the planes of the checkpoint's four neighbour ids (`+0x20..+0x23`, `0xff` = none; record `id · 0x24` of racer set `+0x148`, `0x0041e940`), stored as float32, starting at `FLT_MAX`; then a selection sort of `[i, e)` descending by distance swapping all three. `i` then advances by one, not to `e`.
3. Entry `i`'s racer, unless `+0xd04 & 0x1000`, gets position `n − i` through `Racer_SetRacePosition` (`0x0043a210`): with `+0xd04 & 0x2` only stored; else a changed position calls `Racer_PlayVoice` (`0x00439240`: with `+0xd44 == 0`, one draw for the voice `r % 6 (+6 when gaining) + +0xd40`, a sound, one draw for `+0xd44 = r · 4 + 5000`).
4. Audio: with racer set `+0x16c` and `+0x170`, the racer nearest to `+0x170` within 200 drives a sound.

**Hypothesis**: racer `+0xcc4` points into the same 0x24-byte checkpoint records as racer set `+0x148` (both have the progress at `+0x1c` and four neighbour ids at `+0x20`); the port stores it as an index (`checkpointIndex`).

### Pass 9: `RubberBand_Step` (`0x0043a480`, thiscall on racer set `+0x284`: step)

Object: `+0x00` racers, `+0x04` count, `+0x08` delay (15,000 after `0x0043a450`), `+0x0c` bias (race `+0x64c`, see ai.md). While `step ≤ delay`, the delay counts down. Then every sub-step (`+0x08 = 0`): `best` = the largest progress (stored float32) of racers with `+0xd08 ≠ 2`, starting at −1.0. If `best == −1.0`, every racer without `+0xd04 & 0x20100000` gets body `+0x7e8 = 1.0` and, without body `+0x6c0 & 0x40000`, `+0x7ec = 1.0`. Otherwise every racer but the first, without those flags: progress > best → `float32((1 − 0.05) + bias)`; < best → `float32((0.05 + bias) + 1)`; equal → unchanged (`0x004b09dc` = 0.05).

## Ported

- `RacerControls` and the nine binding handlers (`0x00430570`–`0x004306d0`); `PlayerController_Update`, `PlayerController_UpdateSteering`, `0x00430390`, `0x00430790`.
- `Racer_StartPowerSlide`, `Racer_StopPowerSlide` (state only).
- Pass 4, pass 5 and route following as described above, with `0x0041fdb0`, `0x00420380`, `0x004202f0`, `0x0042a730`, `0x0042b0c0`, `0x004a5750`, `0x00429770`, `0x00429c40`, `0x004298a0`..`0x00429920`, `0x00448160`, `0x004490b0`, `0x00441790`, `0x00441330`, `0x00411b90`, `0x00438560`, `0x00438e60`, `0x0040e0b0`, `0x0040dd60`, `0x0043ec10`, `0x0043cbb0`, `0x00439cf0`, `0x00439ea0`, `0x00422100`.
- The driver: `0x0041fb80`, `0x0041fc00`, `0x0041fd60`, `0x0041fe60`, `0x0041fee0`, `0x00420130`, `0x004201e0`, `0x00420260`, `0x004202c0`.
- Car body: `0x00429120` (as `createCarBody`), `CarBody_Update` without the engine sound, `0x0042ad30`, `0x0042ae20`, `0x0042aea0`, `0x00446ef0`, `0x00447f30` (no sound), `0x00448070`, `0x00449070`, `0x00449090`, `0x00445cb0`, `0x004489f0`, `0x00448370`, `0x004483b0`, `0x00448290`.
- Racer: `0x00436bd0` (as `createRacer`), passes 1, 2, 3, 7, 8 (ranking, positions, voice timers), `0x0043a210`, `0x00439240` (state only).
- Reused from `racer-ai` (not ported again): pass 9 (`stepRubberBand`, on car body `+0x778`/`+0x7e8`/`+0x7ec`), `Racer_GetProgress` (`getRacerProgress`), pass 7 step 7 (`updateComputerTaunt` with `findNearestRacerInCone` and the `TAUNT_*` cone). Racer_Taunt (`0x00439c90`) runs before the taunt's draw, so the port asks `updateComputerTaunt` whether it taunts, calls the dependency, then draws.
- Checkpoints are the `checkpoint` module's `Checkpoint` records (plane `[a, b, c, d]`, `links` = the four neighbour ids).
- The random and cosine tables, read from `LEGORacers.exe`.

## Not ported (typed dependencies in `RacerSetStepDependencies` / `PlayerControllerDependencies`)

- `RigidBody_Step` (`0x00444ef0`) and `CarBody_StepOnRoute` (`0x00429d40`), the kinematic route playback of computer racers (car body `+0x744`), built from `racer-ai`'s route follower and speed code; the dependency `stepScriptedCarBody` is where it plugs in. `RacerControls` only drive player racers.
- Pass 6 (audio).
- The slide of a scripted body by `0x00429680` (`separateScriptedCarBody`), the timed-effect transfer `0x00439900` and end `0x00439b00` (`transferTimedEffect`, `endTimedEffect`), the registry volume test (`getIsTouchingRegistryEntry`), the route search `0x0043d070`, the emitters' particles of `Vehicle_Update`, `0x0043e740`'s model sway.
- Pass 7 calls: `0x00438f20` (racer-ai's `updatePowerUpUse` implements it once the racer carries the personality and power-up fields), `0x004397b0`, `0x00439b00`, `0x00439c90` (`tauntNearestRacer`), `0x0045b1e0`. `0x00439cf0`, `0x00439ea0` (`updatePlayerGuidance`) and `0x00422100` (`notifyRacerContact`) are ported.
- Player controller calls: `0x00439100` (use power-up), `0x0043a390`, `0x0043a0c0`, `0x0043a3f0`/`0x0043a400`, `0x0045b1e0` + `0x0043df90` (start boost), vehicle effects of the power slide; `0x00430710` and `0x00430760` (race state changes).
- Every sound, the engine sound block of `CarBody_Update` and the nearest-racer sound of pass 8.
- The car rigid body's reset (`0x00444b40`) and attach (`0x00444d90`); `createCarBody` takes their results as input.

## Open questions

1. The binding names of 0, 1 and 8 (left/right, look behind) need the menu strings (`game.srf`) or a run of the game.
2. `+0x160` (gravity?), `+0x608` (wheel radius?) and `+0xdc` (fade factor?) are named from how they are used here.
3. Whether racer `+0xcc4` always points into the racer set's checkpoint list (see pass 8).
4. Racer_Taunt (`0x00439c90`) calls event `0x00462580`; whether that draws from the random table is not checked.
