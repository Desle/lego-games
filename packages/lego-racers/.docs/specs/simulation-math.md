# Feature: simulation-math

## Behaviour

The vector, matrix, quaternion and frame helpers that `LEGORacers.exe`'s race physics calls (`0x00449170`–`0x004496a0`, frame methods `0x00410900`, `0x00410f30`, `0x00403c90`), ported with the original's operand order and float32 store points. Every function takes a `FloatArithmetic`, the precision policy that decides whether intermediate x87 results are rounded to float32 (24-bit precision control) or kept as doubles (53-bit). Addresses and layouts are in `.docs/reverse-engineering/physics.md`.

## User flows

- **Choose the precision**: the simulation calls `createFloatArithmetic(RACE_FPU_PRECISION)` once and passes the result to every physics function. `RACE_FPU_PRECISION` is the one place to switch between `FpuPrecision.SINGLE` and `FpuPrecision.DOUBLE`.
- **Do vector maths**: a physics function calls `getNormalizedVector3`, `getMatrixProduct`, `getMatrixFromQuaternion` and the others with plain frozen vectors, matrices and quaternions, and gets new frozen values back.

## Invariants

- Every value a function returns has been through `storeFloat` (`Math.fround`), because the original stores every result as float32; values the original keeps on the FPU stack between instructions are not rounded unless the precision is single.
- Additions and multiplications happen in the order of the disassembly, not the decompiler's: in single precision, regrouping a sum changes the result.
- An unordered comparison (a NaN operand) behaves as the x87 `FCOM` does: equal and below at once.
- No function reads a clock, the DOM or a random source, and none mutates its arguments.

## Out of scope

Collision geometry (the `collision` module), the frame's bounding sphere (frame `+0x04`/`+0x10`) and the frame mirror `0x00411040`. The frame transforms (`0x00410c80`, `0x00410cf0`, `0x00410d60`, `0x00410de0`), the axis builders `0x00410a00` and `0x00410b00`, float32 constants by bit pattern and `_ftol` are here.
