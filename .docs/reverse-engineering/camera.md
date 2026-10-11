# The race camera: `Camera_Update` and its presets

Source: `LEGORacers.exe` (English, 1999-07-22), decompiled and read from the x87 disassembly. Port: `packages/lego-racers/src/modules/race-camera`. Anything not proven is marked **hypothesis**.

## Objects

One camera per local player (race `+0x2ad4`, stride `0x150`). Attached by `Camera_AttachRacer` (`0x00428230`). Constructed by `Camera_Reset` (`0x004281b0`: no racer, snap flag, preset row 0, ease rates `0x3db851ec`, `0x3b91a2b4`, `0x3c888889` at `+0x100`, `+0x104`, `+0x108`).

| Offset                       | Meaning                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `+0x00` bit 0, `+0x01` bit 0 | Snap requested; the previous update's copy                                           |
| `+0x02`                      | Mode: 0 introduction, 1 chase, 2 cockpit, 3 finish                                   |
| `+0x04`                      | Look behind (binding 8, `0x0043a3f0`, `0x0043a400`)                                  |
| `+0x05`                      | Second argument of `0x004283f0` (racer flag `0x400000`)                              |
| `+0x08`                      | Target basis (rows right, down, forward), `+0x2c` target eye, `+0x38` its quaternion |
| `+0x48`, `+0x6c`, `+0x78`    | Eased basis, eye, quaternion; `+0x88`, `+0xac`, `+0xb8` the previous frame's copies  |
| `+0xc8`, `+0xcc`             | Time in the mode (finish eases for 2,000 ms), step as float (at most 100)            |
| `+0xd8`                      | Eased heading; `+0xe4` eased look-at point; `+0xf4` steering angle                   |
| `+0xf8`, `+0xfc`             | Ease rates of eye and orientation (from the preset)                                  |
| `+0x10c`                     | sin(height angle); `+0x110`, `+0x114` sin and cos of pitch; `+0x118` follow distance |
| `+0x11c`, `+0x120`           | Driver full-throttle flag; distance factor easing back to 1                          |
| `+0x124..+0x130`             | Finish offsets: old preset minus new                                                 |

## Presets (`0x004283f0`, table `0x004b0328`, stride `0x18`)

Mode, pitch, height angle (degrees), distance, position blend, rotation blend. The camera number (racer `+0xdb8`; binding 5 cycles `(n + 1) & 3`, `0x0043a390`) indexes it; with the second argument set and the number below 3 the row is number + 5. Pitch goes to `sin`/`cos` with `0x004b03ec` (π/180); a blend `p` becomes the rate `(1 - p) / (p * 250)` (`0x00427b70`, `0x00427b90`).

| Row | Mode    | Pitch | Height | Distance | Blends     |
| --- | ------- | ----- | ------ | -------- | ---------- |
| 0   | chase   | 5     | 35     | 20       | 0.1, 0.25  |
| 1   | chase   | 8     | 25     | 30       | 0.1, 0.25  |
| 2   | chase   | 8     | 45     | 10       | 0.05, 0.25 |
| 3   | cockpit | 0     | 0      | 0        | 0.1, 0.25  |
| 4   | finish  | 20    | 15     | 32       | 0.18, 0.35 |
| 5   | chase   | 8     | 20     | 22       | 0.1, 0.25  |
| 6   | chase   | 7     | 15     | 45       | 0.1, 0.25  |
| 7   | chase   | 4     | 30     | 15       | 0.05, 0.25 |

`Race_UpdateState1` (`0x0043a360`) selects the racer's number at the end of the introduction (with a snap); `Race_UpdateState3` selects row 4 when the player finishes.

## `Camera_Update` (`0x00428540`, called per physics sub-step)

Skipped without a racer (it sets the snap flag). A step of 0 returns unless a snap is waiting. The step is capped at 100. The previous basis, eye and quaternion are copied. Modes 1 and 3 (`0x00428767`):

1. Heading = the racer frame's row 0 x, y (`+0x28`, `+0x2c`) normalized; both zero keeps the last heading (1, 0 when none).
2. Snap: steering angle 0 and the heading as is. Car body flag `0x2` (`+0x6c0`): the stored heading. Otherwise the steering angle eases (`+0x104`) toward `forwardSpeed * 80 / turnRadius` (`+0x618`, `+0x64c`; clamped to ±0.3; 0 for a zero radius); the heading is rotated by it (the second component uses the new first one), the angles of the old and new heading (`0x00428f40`) are compared and a difference beyond ±0.014016 is wrapped to ±π and eased by `+0x108`.
3. The look-at point eases toward the racer by `1 / (+0x100 * step + 1)`; a snap takes it whole.
4. Distance: when the driver's full-throttle flag (`+0xc84` bit 0) begins, the factor `+0x120` starts at -0.2, -0.4, -0.6 or 1.0 by turbo level (`+0xd68`) and grows by 0.004 per ms below 0 and 0.002 above; below 1 the distance is the factor times the preset's, at least 12.
5. Look vector `(cos(pitch) * heading, -sin(pitch))`; eye = look-at point minus `(look - (0, 0, sin(height))) * distance`, using the previous frame's forward row when not snapping. The basis is built by `Camera_BuildBasis` (`0x004282d0`) with up `(0, 0, -1)`.
6. Finish (mode 3): for 2,000 ms the preset offsets fade out (`1 - t * 0.0005`) and the heading turns half a circle (`t * π / 2000`); afterwards the look vector is reversed.

`Camera_EaseToTarget` (`0x004280a0`) then eases: eye by `1 / (+0xf8 * step + 1)`, quaternion by `1 / (+0xfc * step + 1)` (`0x004495e0`), basis from the quaternion (`0x00449340`); a snap copies the target.

Mode 2: eye = racer position + 10 (6 with `+0x05`) in z, basis from the racer's row 0 and its negated row 2.

`Camera_ApplyToFrame` (`0x00427d30`) hands the camera frame its position (slot `+0x44`) and `(forward, up)` (slot `+0x24`): forward is basis row 2, up is row 1, which points down; the engine's cameras take a negated up (see `world.md`). Looking behind mirrors the eye through the look-at point (chase) and turns forward and up half a turn around z; the cockpit camera reverses forward.

## Not ported

Mode 0 (introduction fly-through from the race description's camera point); `0x00427e80`, the field-of-view effects (warp, and the curse's random shake which draws from the shared random table); the camera object's lock (`+0x28`); the sound listener (`0x00427c00`). **Hypothesis:** the viewer's 60° field of view stands in for the Direct3D camera.
