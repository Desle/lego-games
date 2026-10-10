# Computer racers

Source: `LEGORacers.exe` (English, 1999-07-22). Float rules come from the disassembly; the decompiler was used only to find the code. Anything not proven by code is marked **hypothesis**. The port lives in `packages/lego-racers/src/modules/racer-ai`; routes are parsed by `computer-racer-route` (RRB, `0x004a4e30`), randomness comes from `random-table` (see [random-table.md](random-table.md)).

## How the computer drives: route playback, not control input

Computer racers do **not** produce steering or throttle. `0x004374c0` (racer reset) calls `0x0042a670` on the car body when the racer has a route (racer `+0xe2c`): it sets car body `+0x744 = 1`, resets the route follower at car body `+0x74c` (`0x004a5200`) and places the frame at the route start. From then on `CarBody_Update` (`0x004293f0`) runs `0x00429d40` instead of `RigidBody_Step`: the car is moved kinematically along the recorded route, with a speed factor, a sideways offset and a vertical bounce on top. The physics only handles contacts (`RigidBody_AdvanceToContact`). So there is no `RacerControls` output for the AI: its output is the follower's position and rotation, which `0x0042a570` turns into the car's frame. A shared `RacerControls` type does not apply.

Route data, as the computer code reads it (`ComputerRacerRoute` from `computer-racer-route`):

| Route field (`0x48` bytes)                     | Parser field       | Use                                                           |
| ---------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| `+0x00` count, `+0x04` samples (12 bytes each) | `samples`          | Played in order                                               |
| `+0x08` vector (token `0x29`)                  | `firstVector`      | Start position (`0x004a5320`, first advance)                  |
| `+0x14` quaternion (`0x28`)                    | `firstQuaternion`  | Start rotation                                                |
| `+0x24` vector (`0x2a`)                        | `secondVector`     | Loop position: where playback continues after the last sample |
| `+0x30` quaternion (`0x2b`)                    | `secondQuaternion` | Loop rotation                                                 |
| `+0x40` integer (`0x2c`)                       | `firstInteger`     | Loop time (ms)                                                |
| `+0x44` integer (`0x2d`)                       | `sampleIndex`      | Loop sample index                                             |

Sample (`0x004a5e10`; parser `first`, `second`, `bytes[0..7]` = sample `+4..+11`):

| Bytes                             | Decoder                                                     | Meaning                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `+0` int16, `+2` int16, `+4` int8 | `0x004a5ef0`: × 2⁻⁸, × 2⁻⁸, × 2⁻⁴ (FILD, FMUL, FSTP)        | Offset from the previous sample's position                                                                                                |
| `+5..+8` int8                     | `0x004a5f40`: × float32 `0x3c010204`                        | Rotation quaternion (absolute)                                                                                                            |
| `+9`, `+10` int8                  | `0x004a5fa0`, `0x004a5fc0`: × 0.125 (left on the FPU stack) | Lateral room on the negative and positive side; `0x00429680` clamps the sideways offset to `[-byte9, byte10]` (mirrored routes swap them) |
| `+11` bits 6–7                    | `0x004a5ec0`: 0, 1, 2, or 4 for 3                           | Contact state, copied to car body `+0x36c` by `0x0042a570` (**hypothesis**: wheels touching the ground)                                   |
| `+11` bits 0–5                    | `0x004a5ee0`: `<< 5`                                        | Milliseconds from the previous sample                                                                                                     |

## Route follower (`0x78` bytes at car body `+0x74c`)

| Offset           | Port field                                     | Meaning                                                   |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `+0x00`          | `position`                                     | Interpolated position                                     |
| `+0x0c`          | `rotation`                                     | `Math_BlendQuaternions` (`0x004495e0`) of the two samples |
| `+0x1c`          | `contactState`                                 | Of the last sample entered                                |
| `+0x20`, `+0x24` | `negativeLateralLimit`, `positiveLateralLimit` | Interpolated bytes 9 and 10                               |
| `+0x28`          | `route`                                        |                                                           |
| `+0x2c`          | `speedFactor`                                  | Playback speed (car body `+0x778`)                        |
| `+0x30`          | `time`                                         | float32 ms                                                |
| `+0x34`, `+0x38` | `previousSampleIndex`, `nextSampleIndex`       | −1 before the first advance                               |
| `+0x3c`, `+0x48` | `previousPosition`, `nextPosition`             |                                                           |
| `+0x54`, `+0x64` | `previousRotation`, `nextRotation`             |                                                           |
| `+0x74`          | `previousTime`                                 | int ms                                                    |

- `0x004a5200` (`resetRouteFollower`): previous index −1, time 0, next index 0, previous time 0.
- `0x004a5220` (`startRouteFollowerAtLoop`, used by the driver figure `0x004202f0`/`0x004203b0` through `0x0042a730`): jumps to the loop point. It does **not** reload the next rotation.
- `0x004a5320` (`advanceRouteFollower`, thiscall: float step): `time += speedFactor * step` (`FST` stores, `_ftol` truncates the unrounded value), then steps backward (target before the previous sample; at sample 0 the target and time become 0) or forward (target at or after the next sample). Past the last sample it wraps to the loop point: previous time = loop time, the target moves by `loopTime − nextTime`, but the running next time is **not** reset (bug-for-bug). Finally `fraction = (target − previousTime) / (nextTime − previousTime)` (two `FILD`, `FDIVP`, `FSTP`), and limits, position (the x product kept on the stack, y and z products stored) and rotation are interpolated.

## Speed (`0x00429d40`, car body step for route-driven bodies)

Per contact pass, with the step converted to float32 (`FILD`, `FSTP`):

1. Before the loop, with car body flag `0x10000` and `+0x77c < 2000`: target = `(2.75 − 1.7) · −((t − 2000) / 2000) + 1.7` (`getRampedTargetSpeedFactor`).
2. Speed factor toward the target (`stepComputerSpeedFactor`): skipped when flag `0x40000` is clear, one of `0x90002` is set and the contact state is non-zero. Up at 0.00048828125/ms (0.01 with `0x10000`, 0.002 with `0x40000`), down at 0.002/ms (0.000732421875 with `0x40000`), never past the target.
3. `0x004a5320` with the float step.
4. Sideways offset `+0x7cc` back toward 0 at 0.001953125/ms (`getReturnedLateralOffset`).
5. Vertical bounce `+0x7c8`/`+0x7d0`: speed += −100 · step · 0.001, height += step · 0.001 · speed; at height ≤ 0 both become 0 and flag `0x80` clears (`stepComputerBounce`).
6. Not ported: `0x0042a100` (flag `0x8`), `0x004464a0` (flag `0x8` or `+0x658`), `0x0042a290` (frame rotation from the follower, tilts and spins from `+0x680`, `+0x5dc`/`+0x7e0`, `+0x5e0`), `0x0042a570` (frame position = follower position + rotation row 1 × `+0x7cc`, height terms `−+0x7c4 +0x7e4 +0x7c8 +0x658`), the velocity from the moved frame, and `RigidBody_AdvanceToContact`; a contact sets the speed factor to −0.1 (`CONTACT_SPEED_FACTOR`).

Target changes: `0x00429990` (`getPushedSpeedState`, car body vtable slots `+0x524`/`+0x52c` via `0x004298a0`/`0x004298f0`) sets flag `0x40000` and the target to `speed + push·forward / 300` clamped to [−0.5, 2.75] (0.3 ± 0.1 with flag `0x2`); `0x00429940` (`getRestoredSpeedState`) clears `0x40000` and restores the default target (0.3 with flag `0x2`); `0x004293c0` (`getReleasedSpeedState`) clears `0x80000` and sets 1.0 when none of `0x50002` is set. Flag names in the port describe these effects (**hypothesis** for their meaning in the game).

## Rubber-banding (`0x0043a480`, `RacerSet_Step` pass 9)

The object at racer set `+0x284` (`0x0043a450`): racers, count, a countdown of 15,000 ms and a bias at `+0xc` (race `+0x64c`, set to 0.05 from `0x004b07f0` by `0x00433773` when `Race_LoadTrackContent`'s argument is non-zero; **open**: what that argument means and the default value). Each sub-step after the countdown (it stays 0, so the code runs every sub-step):

- Leader = the highest progress (`0x0043a0a0`: lap `+0xd18` + checkpoint `+0x1c` progress, 0 without a checkpoint) among racers whose `+0xd08` is not 2 (not computers).
- No leader (best still −1.0): every racer without `+0xd04 & 0x20100000` gets default target 1.0, and target 1.0 unless flag `0x40000`.
- Else, for racers 1.. (racer 0 skipped) without `0x20100000`: ahead of the leader → `0.95 + bias`, behind → `1.05 + bias`, equal → unchanged; written to the default target and (unless `0x40000`) the target.

Ported: `stepRubberBand`, `getRacerProgress`, `createRubberBand`. The checkpoint progress comes from the `checkpoint` module (`0x0041e950`).

## Personality and difficulty (`0x00436df0`, `0x00436970`)

Six driver bytes (description `+0x6c..+0x71`, 100 each for a custom driver in `0x0043b480`) become racer `+0xd1c..+0xd21` = `_ftol(min(byte · S · 0.01 + 0.2, 1.0) · 255)`, where `S` = `(1 − 0.2) · 100 · (1/90)` is computed once by the static initializer `0x00436970` (53-bit precision: the CRT's `initterm` runs after `SetDefaultFpuPrecision`). `+0xd22` = `_ftol((d1d − d1f − d1e + d1c) · 0.001953125 · 30)`, or 0 when the sum is negative. Ported: `getComputerPersonality`, `PERSONALITY_SCALE`. No other difficulty setting reaches the AI code found here.

## Power-up use (`0x004377f0`, `0x00438f20`)

`0x004377f0` adds the step to racer `+0xcd8`; above `+0xcdc` it resets to 0, sets the interval to 150 ms and, for a computer (`+0xd08 == 2`) holding a power-up (`+0xccc`), runs `0x00438f20`:

1. 20 or more active power-up objects (power-ups `+0x187c`) → wait (interval 1,000 ms).
2. Preferred power-up `+0xcd0` held and level `+0xd58 < +0xcd4` (unsigned) → wait.
3. Jump table `0x004390f0`: power-up 1 needs a racer in the cone `0x0043ca60(100, 62,500, 0.96)` along rotation row 0, else keep; then low byte `<` `+0xd1c`. Power-up 2: `+0xd1f`. Power-up 3: `+0xd1e`, then kept when (`+0xd04 & 0x1000` and level 3) or car body flag `0x2`. Power-up 4: `+0xd1d`. A failed roll waits; success calls `0x00439100` (not ported: it dispatches to the power-up manager).

Ported: `updatePowerUpUse`, `decidePowerUpUse`, `findNearestRacerInCone` (`0x0043ca60`: squared distance from the unrounded differences, normalized stored offset, dot ≥ cosine, nearest wins, the asker included).

## Taunts (`0x004377f0`)

Racer `+0xd34` counts down; at 0 a computer racer queries the cone `(0, 169, 0.3)`: a hit taunts (`0x00439c90`: sound `+0xd23` and an event; not ported) and draws `value · 8 + 2000`, a miss waits 2,000 ms. Ported: `updateComputerTaunt`, `createComputerTimers` (both timers drawn by `0x00436df0`).

## Route variant (`0x00433190`)

Ported once, in `computer-racer-route` (`countComputerRacerRouteVariants`, `chooseComputerRacerRoute`, `getFallbackComputerRacerRouteFileNames`); feed its `drawRandomValue` callback from `random-table`. Disassembly check: the probe loop runs while `0x0044c9c0` returns 0 (found) and the count is below 10, so with ten variants it also probes `'0' + 10` (`:`), which only matters for a file-system callback with side effects.

## Ported / not ported

Ported (`racer-ai`): `0x004a5200`, `0x004a5220`, `0x004a5320`, `0x004a5ec0`, `0x004a5ee0`, `0x004a5ef0`, `0x004a5f40`, `0x004a5fa0`, `0x004a5fc0`; the speed, offset and bounce parts of `0x00429d40`; `0x00429990`, `0x00429940`, `0x004293c0`; `0x0043a450`, `0x0043a480`, `0x0043a0a0`; `0x00436970` and the personality and timer parts of `0x00436df0`; `0x0043ca60`; `0x00438f20`; the power-up and taunt timers of `0x004377f0`; MSVCRT `_ftol` (`getFloatToInteger`).

Not ported: `0x004a5750` (moves the follower along the route by a displacement: collisions `0x00429680` and race start `0x0042b0c0`), `0x00429680`, `0x0042b0c0`, `0x0042a100`, `0x0042a290`, `0x0042a570`, `0x004464a0`, the contact loop of `0x00429d40`, `0x00439100`, `0x00439240`, `0x00439340`, `0x00439c90`, `0x0043d070` (route lookup for racers without one), `0x0043a0e0`, `0x004374c0`/`0x0042a670`, the rest of `0x004377f0` and `0x00436df0`, and every non-AI random-table caller (see random-table.md).
