# Binary token reader (`*DB` files)

Source: `GolDP.dll` (image base `0x10000000`). The `.GDB`, `.MDB` and `.WDB` loaders read their files through one tokenizer. This page duplicates the token-reader section of `world.md` (branch `feature/world-format`) so this branch is self-contained.

| Address                                                   | Role                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `0x10032440`                                              | Base reader constructor (vtable `0x100578bc`)                                                             |
| `0x1002fff0`                                              | Binary reader constructor, object `0x650` bytes, vtable `0x1005780c`; zeroes `+0x1f0..+0x650`             |
| `0x10032670`                                              | Sets the default extension (`.gdb` `0x1005ce38`, `.mdb` `0x1005ceac`) at `+0x1e8`                         |
| `0x10030070`                                              | vtable `+0x38`: opens the file (stream flags 2, buffer `0x1000`), resets position, last token, push-back  |
| `0x10030300`                                              | vtable `+0x44`: next token                                                                                |
| `0x10030c30`                                              | Macro definition (token `0x16`)                                                                           |
| `0x10030da0`                                              | Next token from a repeat, macro or the array-header table `0x100577f8` (`7 4 8 8`)                        |
| `0x10030e40`                                              | vtable `+0x40`: error; message from the table at `0x1005f260` (20 entries) plus `file %s`, then fatal     |
| `0x10031800`                                              | Stream vtable `+0x24` `read(offset, buffer, size, bytesRead*)`: returns `0x10` only when nothing was read |
| `0x100326a0`                                              | Read int (token 4, else error 4)                                                                          |
| `0x100326c0`                                              | Read float (token 3, else error 3)                                                                        |
| `0x100326e0`                                              | Read string (token 2, else error 2)                                                                       |
| `0x10032700`                                              | Read string of at most N characters (else error 14 "Invalid string")                                      |
| `0x10032740`                                              | Expect a given token (else error 19 "Expected keyword")                                                   |
| `0x10032760` / `0x10032780` / `0x100327a0` / `0x100327c0` | Expect `[` `]` `{` `}` (errors 7, 8, 5, 6)                                                                |
| `0x100327e0`                                              | Array header `[ int ] {`, returns the int                                                                 |
| `0x1002ff80`, `0x1002ffb0`, `0x1002ffd0`                  | Static initialisers of the scale constants `1/4096`, `1/32`, `1/127` (float32)                            |

The error callback is installed by `LEGORacers.exe` (`0x00416960` passes `0x0042f8b0` as `GolEntry` parameter `[10]`): it shows a "Fatal Error" message box and calls `exit(1)`, so every reader error ends the game. The port throws.

## Tokens

| Byte                     | Payload                                                             | Returns                                                                       |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `0x00`                   | —                                                                   | 0, which every loader treats as end of file                                   |
| `0x02`                   | up to 63 bytes, copied up to a NUL; position advances by length + 1 | 2 (string)                                                                    |
| `0x03`                   | float32                                                             | 3                                                                             |
| `0x04`                   | int32                                                               | 4                                                                             |
| `0x05`..`0x0a`           | —                                                                   | `{` `}` `[` `]` `,` `;`                                                       |
| `0x0b`, `0x0c`           | uint8                                                               | 4                                                                             |
| `0x0d` / `0x0e`          | int16 / uint16                                                      | 4                                                                             |
| `0x0f` / `0x10` / `0x11` | int16 × 1/4096, × 1/32, × 1                                         | 3                                                                             |
| `0x12`                   | uint8 × float32(1/127)                                              | 3                                                                             |
| `0x13`                   | uint16                                                              | that value as the token (no payload read)                                     |
| `0x14`                   | uint16 count, token byte (`0x13` + uint16)                          | repeats the token / macro / `0x15` count times                                |
| `0x15`                   | —                                                                   | expands to `[ int ] ]`                                                        |
| `0x16`                   | macro token, length, tokens                                         | defines macro `token − 0x17` (16 × 16 slots at `+0x210`, lengths at `+0x610`) |
| `0x17`..`0x26`           | —                                                                   | expands that macro                                                            |
| anything else            | —                                                                   | itself (keywords from `0x27`)                                                 |

Expanded tokens go through the same dispatch, so a value token from a repeat or macro still reads its payload from the file. No byte left gives token 0; fewer bytes than a payload needs is error 0. A macro definition is followed by a test of the _last returned_ token, so a file starting with `0x16` reads as empty.
