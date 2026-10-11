# Emulator differential tests

The ports are proven against the original code, not against our reading of it: `LEGORacers.exe` and `GolDP.dll` run in a CPU emulator (Unicorn, x86 32-bit) on any machine, and the port's results are compared with theirs bit for bit. No Windows is involved.

## How it works

```
vitest (TypeScript)  --JSON lines-->  reverse-engineering/emulator/bridge.py  -->  Unicorn
 src/shared/emulator/                  emulator.py, pe_image.py, stubs.py
```

- **Images.** `pe_image.py` maps the PE sections of `LEGORacers.exe` (base `0x00400000`) and `GolDP.dll` (base `0x10000000`) at their preferred bases, so no relocation is applied (neither image overlaps the other). The files come from `original-files/Lego_Racers_Win_Files_EN/Game Files/` or `LEGO_RACERS_GAME_FILES`.
- **Imports.** Every import table entry points to its own stub address (`0x7e000000` and up) that traps. `stubs.py` implements `_ftol`, `_CIacos`, `floor` and `ceil`; any other import aborts the call with `unstubbed import <dll>!<name>`. The leaf functions tested so far call no imports.
- **Calling.** `Emulator.call(address, convention, arguments, precision, buffers, reads)`: `cdecl`, `stdcall`, `thiscall` (first argument in ECX) and `fastcall` (first two in ECX and EDX). Buffers (uint32 words, so floats go in as their bit patterns) are written to a scratch heap (`0x20000000`); an argument is a number or `{buffer, offset}`; a word inside a buffer may also be `{buffer, offset}`, which builds structs with pointers (a rigid body pointing at its frame). A sentinel return address (`hlt`) ends the run. The result holds EAX, the raw 80-bit ST0, the x87 stack depth (always 0 for a well-formed call) and the requested buffers.
- **x87 control word.** Before each call the runner writes `0x007f` (24-bit significand, all exceptions masked) or `0x027f` (53-bit), clears the status word and empties the stack.
- **Bridge.** One JSON object per line on stdin (`op`: `call`, `batch`, `ping`), one per line on stdout; a failure answers `{"error": "..."}`. The TypeScript client batches 500 calls per request.
- **Tests.** `src/shared/emulator/` holds the client (`emulator-client.ts`), a seeded generator (`seeded-random.ts`, mulberry32, so a failing case replays from its function name) and `defineDifferentialSuite`, which runs a definition in both precision modes and fails with the first mismatches, the number of differing cases and the differing positions of the output. The specs sit beside the code as `*.differential.spec.ts` and skip when the virtualenv or the original files are missing.

## Run it

```
pnpm run differential          # creates reverse-engineering/emulator/.venv (Unicorn 2.1.4) if needed, then runs the suites
```

The whole package suite (`pnpm run check`) already includes them: about 3 s in total for 28 float functions and 10376 LZSS blocks, so they are not a separate step. With no virtualenv or no original files (CI) they skip. Symlink the player's `LEGORacers.exe`, `GolDP.dll` and `LEGO.JAM` into `original-files/Lego_Racers_Win_Files_EN/Game Files/` first.

## Does Unicorn honour x87 precision control?

**Yes.** `normalize(1, 2, 3)` (`0x004492d0`) gives z = `0x3f4d41b2` with control word `0x007f` and `0x3f4d41b3` with `0x027f`, exactly as `physics.md` predicts (`emulator-client.spec.ts` asserts it). QEMU's softfloat rounds to a 24- or 53-bit significand and keeps the 15-bit exponent, which is the hardware behaviour; this is how the port's exponent-range error was found (below).

## Limits

- **`FSIN`, `FCOS`, `FSINCOS` are not the x87's.** Unicorn computes them with the host `sin`/`cos` on a double (200 of 200 sampled results have 11 zero low bits; the error against the true value is about 2¹⁰ ulps of a 64-bit significand), and the port uses `Math.sin`. A match proves the port equals a double-accurate sine, not the real FPU: a stored float32 differs only when the true value lies within about 2⁻²⁹ relative of a rounding boundary, and no test here can show it.
- **Out of range operands.** From 2⁶³ and for infinity and NaN, Unicorn leaves the operand and sets C2, so the stack underflows (hardware raises invalid-operation). The game cannot reach them; the sampler keeps angles in range (`sampleAngle`).
- **NaN payloads.** JavaScript does not expose them, so any NaN equals any NaN. The x87's default NaN is `0xffc00000`; the port's is `0x7fc00000`. Sign of zero and infinities are compared exactly.
- **80-bit internals.** Only values stored to memory, EAX or ST0 are observed; the intermediate x87 registers are not.
- **Imports.** Only `_ftol`, `_CIacos`, `floor` and `ceil` are stubbed (`_CIacos` with Python's `acos`, not the CRT's `fpatan` sequence). Functions that call anything else need a stub first.
- **State.** Memory of the images persists between calls (the scratch heap and the stack do not); the tested functions write no globals. There is no TEB or `fs` segment, so code with structured exception handling does not run.
- **Instruction limit.** Five million instructions per call.

## Add a function

1. Find its address, calling convention and struct layout: `reverse-engineering/ghidra-query.sh exe disassemble <start> <end>` (arguments sit at `[ESP+4]…`, `RET n` shows the callee pops `n` bytes, ECX means `thiscall`, ECX and EDX `fastcall`).
2. Add `<name>.differential.spec.ts` beside the port and call `defineDifferentialSuite({ definition, generateInput, fixedInputs })`. A definition lists the argument `slots` in call order (`floats`, `float`, `integerInput`, `reference`, `output`, `struct`) and a `runPort(precision, input)` that returns the same floats in the same order as the outputs. Inputs are flat float arrays, rounded to float32 for both sides.
3. For an object with fields at offsets use a `struct` slot (inputs at `byteOffset`s, `pointers` for vtables and other buffers, `outputs` to read back); see `rigid-body-integration.differential.spec.ts`, which runs the original `RigidBody_Integrate` through the real frame methods in the original vtable.
4. Cover the cases that reach every branch: the sampler offers uniform values, values across the exponent range, edge values (zero, negative zero, NaN, infinities, denormals) and random bit patterns (`sampleList`, `getIsChance`, `sampleIntegerBelow`). Break the port on purpose once to see the suite fail.
5. Anything that is not float32 in and out (the LZSS decompressor works on bytes) calls `session.callBatch` directly; see `lzss-decompressor.differential.spec.ts`.
6. Add a row to the table below.

## Results

3000 generated cases per function and precision, plus the listed fixed ones; every case compares all output floats bit for bit. "Before" is the number of single-precision mismatches before the exponent-range fix in `createFloatArithmetic` (double precision matched from the start).

| Function (original address)                             | Port                                | Single                | Double             | Single before the fix |
| ------------------------------------------------------- | ----------------------------------- | --------------------- | ------------------ | --------------------- |
| `Math_SinCos` `0x00449170`                              | `getSineCosine`                     | match                 | match              | 0 (host `sin`)        |
| `Math_MultiplyMatrix3` `0x00449190`                     | `getMatrixProduct`                  | match                 | match              | 27                    |
| `Math_NormalizeVector2` `0x00449280`                    | `getNormalizedVector2`              | match                 | match              | 71                    |
| `Math_NormalizeVector3` `0x004492d0`                    | `getNormalizedVector3`              | match                 | match              | 92                    |
| `Math_NormalizeVector3`, target = source                | `getNormalizedVector3`              | match                 | match              | 97                    |
| `Math_QuaternionToMatrix` `0x00449340`                  | `getMatrixFromQuaternion`           | match                 | match              | 117                   |
| `Math_MatrixToQuaternion` `0x00449460`                  | `getQuaternionFromMatrix`           | match                 | match              | 0                     |
| `Math_BlendQuaternions` `0x004495e0`                    | `getBlendedQuaternion`              | match                 | match              | 10                    |
| `Math_RotateVectorAroundAxis` `0x004496a0`              | `getVectorRotatedAroundAxis`        | match                 | match              | 34                    |
| `Frame_GetAxes` `0x00403c90`                            | `getFrameAxes`                      | match                 | match              | 0                     |
| `Frame_SetAxes` `0x00410900`                            | `getRotationFromFrameAxes`          | match                 | match              | 100                   |
| `Frame_GetMatrixInFrame` `0x00410f30`                   | `getMatrixInFrame`                  | match                 | match              | 73                    |
| `Frame_SetFirstAndSecondAxes` `0x00410a00`              | `getRotationFromFirstAndSecondAxes` | match                 | match              | not measured          |
| `Frame_SetThirdAndFirstAxes` `0x00410b00`               | `getRotationFromThirdAndFirstAxes`  | match                 | match              | not measured          |
| `Frame_RotateVector` `0x00410c80`                       | `getFrameRotatedVector`             | match                 | match              | not measured          |
| `Frame_InverseRotateVector` `0x00410cf0`                | `getFrameInverseRotatedVector`      | match                 | match              | not measured          |
| `Frame_TransformPoint` `0x00410d60`                     | `getFrameTransformedPoint`          | match                 | match              | not measured          |
| `Frame_InverseTransformPoint` `0x00410de0`              | `getFrameInverseTransformedPoint`   | match                 | match              | not measured          |
| `Vector_CrossProduct` `0x00404510`                      | `getStoredCrossProduct`             | match                 | match              | not measured          |
| `RigidBody_AddForce` `0x00440b10`                       | `addForce`                          | match                 | match              | 0                     |
| `RigidBody_AddTorqueOfForceAtPoint` `0x00440b50`        | `addTorqueOfForceAtPoint`           | match                 | match              | 9                     |
| `RigidBody_RemoveAngularMomentumAlongAxis` `0x00440da0` | `removeAngularMomentumAlongAxis`    | match                 | match              | 20                    |
| `BoxRigidBody_ComputeInertia` `0x00441260`              | `getBoxInertia`                     | match                 | match              | 98                    |
| `RigidBody_UpdateWorldInverseInertia` `0x00440a60`      | `getWorldInverseInertia`            | match                 | match              | 47                    |
| `RigidBody_UpdateAngularVelocity` `0x00440a80`          | `getAngularVelocity`                | match                 | match              | 2                     |
| `RigidBody_Integrate` `0x00440e10`                      | `integrateRigidBody`                | match                 | match              | 205                   |
| LZSS decompressor `0x10032840` (GolDP.dll)              | `decompressLzss`                    | 10376 of 10376 blocks | n/a (integer code) | 0                     |

The LZSS test decodes every compressed block of every bitmap in `LEGO.JAM` (10376 blocks) in the original's own 1500-byte buffer and compares the return value and all 1500 bytes.

## Mismatches found

1. **Exponent range in single precision (port bug, fixed).** The port rounded every 24-bit operation with `Math.fround`, which also clamps the exponent to float32's. The x87 narrows the significand only (Intel SDM, precision control; the instructions are plain `FMUL`/`FADD`/`FDIV`/`FSQRT` on registers, and only `FST`/`FSTP float ptr` store a float32), so an intermediate such as `x²` for `x = 10²⁵`, or a product of two tiny values, keeps its value until the store. Example: `Math_NormalizeVector2(-8.68, -7.32e24)` returns `(-1.185e-24, -1)` in the original and `(-0, -0)` in the port (`x² + y²` overflowed to infinity). `createFloatArithmetic(SINGLE)` now rounds to a 24-bit significand with the exponent range of a double; `storeFloat` still rounds to float32. All 15 functions measured before the fix match afterwards. It matters only for operands beyond about 10¹⁹ or below 10⁻¹⁹, which a race does not normally reach, but the port is now exact there too.
2. **Test artefacts, not port faults.** An early generator produced inputs that were not float32 (`1 + 0.0123` as a double), and the original, which reads float32 memory, differed from the port by one bit. The suite now rounds every input to float32 for both sides.

No other mismatch was found: in particular every operand order, stored-versus-unstored intermediate and branch described in `physics.md` for these functions reproduces the original bit for bit in both precision modes.

## The whole process

Besides single calls the emulator boots both images the way Windows does and runs the real race loop frame by frame with scripted time and keys: Win32, C runtime, DirectDraw, Direct3D and DirectInput are stubbed, `GolDP.dll`'s device initialisation, the JAM archive, the loaders and the input manager are the game's own code. See [golden-trace.md](golden-trace.md) (`pnpm run golden-trace`). It showed that the race runs with a **24-bit** significand (`DDSCL_FPUSETUP`, control word `0x7f`), which settles `RACE_FPU_PRECISION`.

## What is still open

Sine and cosine against the real FPU (see Limits). Functions that call imports or other unported code are not covered: the rest of `RigidBody_Step`, `RacerSet_Step`, `Race_Update`.
