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

### `RigidBody_Step` (`0x00444ef0`, rigid body vtable `0x004b0d8c` slot 1)

1. `RigidBody_ClearContacts` (`0x00447880`): zeroes `+0x3d0..+0x3dc` and `+0x3ec`.
2. Countdowns in milliseconds at `+0x6e0` (with flag `+0x6c0` & `0x80`, ends in slot `+0x3c`), `+0x5e0`, `+0x5e4`, `+0x5d8` and `+0x5dc`. When `+0x5d8`, `+0x5dc` or (flag `0x2` clear) `+0x5e0` runs out, the angular momentum along rotation row 0, row 1 or row 2 is removed (`RigidBody_RemoveAngularMomentumAlongAxis`, `0x00440da0`). **To verify in the disassembly**: in the flag-`0x2` branch with a non-zero `+0x5e0` not larger than the step, the decompiler continues with the timer's value instead of the step.
3. Flag `0x8`: `0x00448840`. Then `+0x3f0` = step and `RigidBody_SaveStepStart` (`0x004474c0`) copies velocity, position, inertia and wheel data to `+0x684..` and to globals `0x004c6e90..0x004c6ee0`.
4. Loop: `0x00445500` (forces, through `RigidBody_AddForce` and `RigidBody_AddTorqueOfForceAtPoint`), **`RigidBody_Integrate` (`0x00440e10`)**, `0x00445d10`, `0x00445dc0` or (flag `0x8`) `0x004464a0` + `0x004465c0`, `0x00446fd0`, `0x00447330`, slot `+0x10`, frame slot `+0x2c` (world centre of mass), `RigidBody_UpdateWorldInverseInertia` (`0x00440a60`); then `RigidBody_AdvanceToContact` (`0x004478b0`, step, `!(flags & 0x1000)`), which returns the milliseconds left after a contact. Without a contact it returns 0 and the loop ends after one pass.
5. `+0x6dc` += step while `+0x36c` is 0, else 0; two sound objects (`+0x6e8`, `+0x6e4`) get the position and velocity; `0x004452b0`.

**Ported**: only step 4's `RigidBody_Integrate` and the helpers it and `0x00445500` call. **Not ported**: everything else, including `RigidBody_AdvanceToContact` (it tests four points at `+0x3a0` against the world through `0x00403fa0`, keeps the deepest contact normal in `+0x3e0`, and returns `_ftol(…) - 5` when that is above 4; the `_ftol` argument is not yet read from the disassembly).

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

| Offset           | Type    | Meaning (port field)                                                                                                                                                             |
| ---------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x00`          | vtable  |                                                                                                                                                                                  |
| `+0x04`          | pointer | The frame the body moves (`frame`); set by `RigidBody_Attach` (`0x004409f0`). **Hypothesis**: the car's own frame at `+0xe4`                                                     |
| `+0x08..+0x10`   | vec3    | Linear velocity, units per millisecond (`linearVelocity`)                                                                                                                        |
| `+0x14..+0x1c`   | vec3    | Centre of mass in frame space (`localCentreOfMass`), set by `0x00441190`                                                                                                         |
| `+0x20..+0x28`   | vec3    | Centre of mass in world space (`worldCentreOfMass`): frame slot `+0x2c` (`0x00410d60`, point × rotation + position)                                                              |
| `+0x2c..+0x4c`   | 3×3     | Inertia in frame space (`localInertia`)                                                                                                                                          |
| `+0x50..+0x70`   | 3×3     | Its inverse (`localInverseInertia`)                                                                                                                                              |
| `+0x74..+0x94`   | 3×3     | Inverse inertia in world space (`worldInverseInertia`) = transpose(R) · `+0x50` · R, by `0x00440a60` → `0x00410f30`                                                              |
| `+0x98..+0xa0`   | vec3    | Angular velocity (`angularVelocity`) = `+0xa4` (row vector) · `+0x74`, by `0x00440a80`                                                                                           |
| `+0xa4..+0xac`   | vec3    | Angular momentum (`angularMomentum`)                                                                                                                                             |
| `+0xb0..+0xb8`   | vec3    | Force accumulator (`force`), `RigidBody_AddForce` `0x00440b10`, cleared by the integrator                                                                                        |
| `+0xbc..+0xc4`   | vec3    | Torque accumulator (`torque`), `0x00440b50`, cleared by the integrator                                                                                                           |
| `+0xc8`          | float   | Mass (`mass`), 1.0 after reset                                                                                                                                                   |
| `+0xcc`          | float   | 1 / mass (`inverseMass`)                                                                                                                                                         |
| `+0xd0..+0xd8`   | vec3    | Box dimensions (`dimensions`), set by `BoxRigidBody_Attach` (`0x00441210`)                                                                                                       |
| `+0xdc`, `+0xe0` | float   | 1.0 and 0 after `0x00441210` (unknown, not modelled)                                                                                                                             |
| `+0xe4..+0x13b`  | frame   | The car rigid body's embedded frame (`Frame_Constructor` `0x004108a0`): rotation at `+0x10c`, position at `+0x130`                                                               |
| `+0x13c..`       | —       | Car rigid body members: contacts (`+0x36c`, `+0x370..+0x3f0`), timers (`+0x5d8..+0x5e4`), flags `+0x6c0`, snapshots `+0x684..+0x6a8`, sounds `+0x6e4`/`+0x6e8`; **not modelled** |

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

| Address      | Name                                          | Port                             | Notes                                                                                                                    |
| ------------ | --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `0x00449170` | `Math_SinCos`                                 | `getSineCosine`                  | One `FSINCOS`; both results stored                                                                                       |
| `0x00449190` | `Math_MultiplyMatrix3`                        | `getMatrixProduct`               | Each element `(p + q) + r` summed on the stack, stored once; which term comes last: `0,0,0 / 0,1,1 / 0,1,0` (by element) |
| `0x00449280` | `Math_NormalizeVector2`                       | `getNormalizedVector2`           | `1 / sqrt(x² + y²)` kept on the stack; zero test is `FCOM double ptr [0x004b0df0]`                                       |
| `0x004492d0` | `Math_NormalizeVector3`                       | `getNormalizedVector3`           | `sqrt((x² + y²) + z²)`; same zero test; a NaN length also gives zero (unordered counts as equal)                         |
| `0x00449340` | `Math_QuaternionToMatrix`                     | `getMatrixFromQuaternion`        | Quaternion stored `x, y, z, w`; scale `2 / (((w² + z²) + y²) + x²)`; `s·z` and `z·s·z` are the values not stored         |
| `0x00449460` | `Math_MatrixToQuaternion`                     | `getQuaternionFromMatrix`        | Trace `(m4 + m8) + m0`; `m4 + m8` is also stored and the x branch reuses the stored copy                                 |
| `0x004495e0` | `Math_BlendQuaternions`                       | `getBlendedQuaternion`           | Dot `((y + z) + w) + x`; `> 0`: `(b - a)·t + a`, else `a - (a + b)·t`; not normalized                                    |
| `0x004496a0` | `Math_RotateVectorAroundAxis`                 | `getVectorRotatedAroundAxis`     | `FSIN` result kept on the stack, `FCOS` result stored; five of the nine matrix terms are not stored                      |
| `0x00410900` | `Frame_SetAxes`                               | `getRotationFromFrameAxes`       | See integrator step 6                                                                                                    |
| `0x00410f30` | `Frame_GetMatrixInFrame`                      | `getMatrixInFrame`               | `transpose(R) · M` with last terms `0,0,0 / 0,1,1 / 0,1,1`, stored, then `Math_MultiplyMatrix3(·, R)`                    |
| `0x00440b10` | `RigidBody_AddForce`                          | `addForce`                       |                                                                                                                          |
| `0x00440b50` | `RigidBody_AddTorqueOfForceAtPoint`           | `addTorqueOfForceAtPoint`        | `(point - worldCentreOfMass) × force`; the z component is not stored before it is added                                  |
| `0x00440da0` | `RigidBody_RemoveAngularMomentumAlongAxis`    | `removeAngularMomentumAlongAxis` | `L - ((L·a) a)`; dot `(Lz·az + Ly·ay) + Lx·ax`                                                                           |
| `0x00440cb0` | `RigidBody_RemoveAngularMomentumAgainstForce` | not ported                       | Removes `L` along `normalize(r × F)` when `L` points that way                                                            |

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
4. **`RigidBody_Step` details**: the timer branch flagged above, the `_ftol` argument in `RigidBody_AdvanceToContact`, and the meaning of `+0x36c` (four means grounded?) need the disassembly.
5. **Which frame the car body moves**: rigid body `+0x04` is set by `RigidBody_Attach`'s caller, not yet traced; the car code reads the rotation at `+0x10c`, which is the embedded frame's.

## Ported and not ported

Ported, with tests:

- `Race_Update` time step (1.75× flag, `_ftol`) and the 40 ms sub-step split; the loop that runs one sub-step per piece.
- `Math_SinCos`, `Math_MultiplyMatrix3`, `Math_NormalizeVector2`, `Math_NormalizeVector3`, `Math_QuaternionToMatrix`, `Math_MatrixToQuaternion`, `Math_BlendQuaternions`, `Math_RotateVectorAroundAxis`.
- `Frame_GetAxes`, `Frame_SetAxes`, `Frame_GetMatrixInFrame` (as pure functions on a rotation matrix).
- `BoxRigidBody_ComputeInertia`, `RigidBody_Attach` (as `createBoxRigidBody`), `RigidBody_UpdateWorldInverseInertia`, `RigidBody_UpdateAngularVelocity`, `RigidBody_AddForce`, `RigidBody_AddTorqueOfForceAtPoint`, `RigidBody_RemoveAngularMomentumAlongAxis`, `RigidBody_Integrate`.

Not ported:

- `RacerSet_Step` and all nine passes (driver figure, `CarBody_Update`, vehicle, AI, …), `Camera_Update`, `GhostRecorder_RecordSample`.
- `RigidBody_Step` apart from the integrator: timers, forces (`0x00445500`), `0x00445d10`, `0x00445dc0`, `0x004464a0`, `0x004465c0`, `0x00446fd0`, `0x00447330`, `0x00448840`, contacts (`RigidBody_AdvanceToContact`, `0x00447cf0`), sounds, `0x004452b0`.
- `RigidBody_RemoveAngularMomentumAgainstForce` (`0x00440cb0`), `Frame_TransformPoint` (`0x00410d60`) and the world centre of mass update, the frame's bounding sphere.
- The rest of `Race_Update` around the sub-step loop.
