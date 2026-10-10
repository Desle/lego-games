# Computer racer routes (`.RRB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/computer-racer-route`.

## Choosing a route (`Race_LoadAiRoutes`, `0x00433190`)

Fastcall on the race, one stack argument (the mirror flag, `RET 0x4`). For each racer `i < settings +0x100` whose kind (`settings +0x114 + 0x5c·i`) is 2 (computer), or for every racer when race `+0x3350` is set:

1. The name is `r`, `'0'+i`, `_`, letter, `_`, `'0'+variant`, `.rr`, then `b` (JAM) or `f` (text) (`0x004331dc`..`0x0043321a`).
2. For the letters `f`, `m`, `s` in that order, `Jam_FindFile` (`0x0044c9c0`) counts the variants present from 0 upwards while the count is below 10 (`0x00433227`..`0x00433293`).
3. When any count is non-zero (`0x0043329d`), one random-table draw (`cursor = (cursor + 1) & 0x3ff`, table `0x004befec`) modulo the total picks the variant: below `f` → `f` and that index, else minus `f` below `m` → `m`, else minus `m` → `s`. Then `AiRoute_Load(race +0x3104 + 0x48·i, name, JAM, mirror)` (`0x00433314`).
4. When none of the six route slots holds samples (`+0x3108` stride `0x48`), `r1_f_0` (`0x004beeec`) + extension, then `r1_m_0`, then `r1_s_0` are tried for slot 0 (`0x00433343`..`0x00433447`).

## Layout (`AiRoute_Load`, `0x004a4e30`)

Keywords are read until token 0 (end of file). The jump table (`0x004a5078`) covers `0x27`..`0x2d`; other tokens are skipped.

| Keyword | Values                                 | Route offset                   | Mirror             |
| ------- | -------------------------------------- | ------------------------------ | ------------------ |
| `0x27`  | `[ n ] {` n samples `}` (`0x004a5100`) | count `+0x00`, samples `+0x04` | per sample         |
| `0x28`  | 4 floats                               | `+0x14`..`+0x20`               | negate 2nd and 4th |
| `0x29`  | 3 floats                               | `+0x08`..`+0x10`               | negate 2nd         |
| `0x2a`  | 3 floats                               | `+0x24`..`+0x2c`               | negate 2nd         |
| `0x2b`  | 4 floats                               | `+0x30`..`+0x3c`               | negate 2nd and 4th |
| `0x2c`  | int                                    | `+0x40`                        | —                  |
| `0x2d`  | int                                    | `+0x44`                        | —                  |

A sample (`0x004a5e10`, 12 bytes) is ten integers stored as `int16 +0`, `int16 +2`, and eight bytes `+4`..`+0xb`. Mirrored: bytes `+9` and `+0xa` are swapped, the `int16` at `+2` and the bytes at `+6` and `+8` negated.

After the loop, `+0x44 >= +0x00` (unsigned) is error 15 "Invalid value". `0x004a50c0` resets the route before loading: zeros, except `+0x20` and `+0x3c` = 1.0 (identity quaternions).

Unknown fields (named neutrally in the port): `firstVector` (`0x29`; in `R1_F_0` it equals start slot 1's position), `firstQuaternion`, `secondVector`, `secondQuaternion`, `firstInteger` (`0x2c`), the sample's two `int16` and eight bytes. `sampleIndex` (`0x2d`) is named from the bound check.

Verified: all 208 `.RRB` files parse to their last byte.
