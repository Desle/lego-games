# Model (`.GDB`)

Source: `GolDP.dll`. A `.GDB` is a stream of keywords read with the token reader (`token-reader.md`). The English `LEGO.JAM` holds 812 `.GDB` files; all parse and are read to their last byte.

| Address                     | Role                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x100068e0`                | Model subclass vtable `0x100563fc` `+0x1c`: calls the loader, then the bounding sphere                                                      |
| `0x100270e0`                | Loader: binary reader when its third argument is non-zero (`.gdb`), dispatches keywords until token 0                                       |
| `0x10027020`                | Model constructor: scale `+0x38` = 1.0                                                                                                      |
| `0x10025f90`                | Keyword `0x27`: material names; each `strncpy(…, 8)` then looked up (`0x10028c20`), failure → `: Material assignment failed`                |
| `0x10025e60`                | Separate loader that reads only `0x27` + the material names (used for objects with no geometry)                                             |
| `0x10027430`                | Keyword `0x2e` (vtable `+0x0`): command list                                                                                                |
| `0x10027740` → `0x1002b3c0` | Keyword `0x2d` (vtable `+0x4`): faces                                                                                                       |
| `0x10027830` → `0x1002be90` | Keyword `0x34` (vtable `+0x8`): position-only vertex buffer (type 5)                                                                        |
| `0x10006aa0` → `0x100156f0` | Keyword `0x28` (vtable `+0xc`): position + texture vertices (type 1)                                                                        |
| `0x10006bc0` → `0x10016ba0` | Keyword `0x29` (vtable `+0x14`): position + texture + 3 more floats (type 2)                                                                |
| `0x10006b30` → `0x10005fc0` | Keyword `0x2a` (vtable `+0x10`): position + texture + color (type 1)                                                                        |
| `0x100278c0`                | Bounding sphere over the vertices referenced by `transform_vertices` commands (not ported)                                                  |
| `0x10006c50`, `0x10006e00`  | Renderer walking the packed commands                                                                                                        |
| `0x1000c630`                | `transform_vertices` callback: transforms `count` vertices from `first` into cache slot `cacheIndex` with the matrix chosen by `0x1000acf0` |
| `0x1000acf0`                | `select_transform`: selects a 0xd0-byte transform entry by index                                                                            |

The other branch of `0x100270e0` (third argument 0) builds an object with vtable `0x100570bc` whose next-token method returns 1 forever; it is not usable, so only the binary path is ported.

## Keywords

| Token  | Content                                                                                                          | Twice →                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `0x27` | `[ n ] { string × n }`; n = 0 → error 4                                                                          | error 18                                  |
| `0x28` | `[ n ] {` (n kept as int16; 0 → error 4, checked before `]`) then n × (x y z u v floats) `}`                     | error 18 (shared by `0x28`/`0x29`/`0x2a`) |
| `0x29` | as `0x28`, 8 floats per vertex (x y z u v, then three floats stored at `+0x1c`, presumably a normal; unverified) | error 18                                  |
| `0x2a` | as `0x28`, 5 floats + 4 ints r g b a per vertex, packed `(a<<24)\|(r<<16)\|(g<<8)\|b` (each `& 0xff`)            | error 18                                  |
| `0x2d` | `[ n ] {` (int; 0 → error 4) then n × 3 ints, each stored as a byte, `}`                                         | error 18                                  |
| `0x2e` | command list, below                                                                                              | error 18                                  |
| `0x33` | float: scale                                                                                                     | allowed                                   |
| `0x34` | `[ n ] {` (int16; 0 → error 4) then n × 3 floats `}`                                                             | error 18                                  |
| other  | error 0 (Syntax error)                                                                                           |                                           |

## Command list (`0x10027430`)

`[ n ] {` (0 → error 4), then n commands, then `}` (else error 6). Each is packed into a `uint32` whose top three bits are the kind. A depth counter, a 10-entry stack (`ESP+0x24`) and a "pending" flag (`ESP+0x50`) drive the slot index:

| Keyword | Operands | Packed                                                                                                                        | Notes                                                                                                                                                                                           |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x27`  | m        | `0x80000000 \| m & 0xffffff` — select material m                                                                              | advances past a pending slot first, then advances                                                                                                                                               |
| `0x31`  | a, b, c  | `(a&0x3f)<<22 \| ((c−1)&0x3f)<<16 \| b&0xffff` — transform c vertices from b into cache slot a (renderer adds 1 to the count) | a ≥ 0x40 or `a + c` > 0x40 (unsigned) → error 17; c is also left at `ESP+0x20`                                                                                                                  |
| `0x2d`  | a, b     | `0x20000000 \| (b&0x7f)<<16 \| a&0xffff` — draw b faces from a                                                                | b > 0xff → error 17                                                                                                                                                                             |
| `0x2f`  | t        | `0xa0000000 \| t & 0xffffff` — push transform t                                                                               | depth ≥ 10 → error 18; sets pending, does not advance                                                                                                                                           |
| `0x30`  | —        | `0xa0000000 \|` new top of stack                                                                                              | depth 0 → error 18; sets pending; popping the last entry reads `ESP+0x20` (the last `0x31` count, uninitialised before any) — the port throws `UnportableModelError` for the uninitialised case |
| `0x32`  | t        | `0xa0000000 \| t & 0xffffff` — set transform t                                                                                | sets pending, does not advance                                                                                                                                                                  |
| other   |          | error 0                                                                                                                       |                                                                                                                                                                                                 |

The stored command count is the slot index at the end, so a trailing transform is dropped. No original file uses `0x2f` or `0x30`.

## Real data

812 files: 667 with materials, vertices (`0x2a` 763 / `0x29` 48), faces and commands; 144 of those also set a scale; one has only `0x27`. The files use tokens `0x0c`, `0x0e`, `0x14`, `0x16`, `0x17`..`0x1d`; no `0x0f`..`0x12` or `0x15`.
