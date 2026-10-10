# World files (`.WDB`)

Source: `GolDP.dll` (English release, image base `0x10000000`). Addresses are virtual addresses in that DLL. `LEGO.JAM` holds 133 `.WDB` files (29 of them empty); every one parses with the rules below and is consumed to its last byte.

A `.WDB` is a stream of tokens read by the engine's generic binary token reader, the same reader the `.GDB`, `.MDB` and other `*DB` loaders use (`0x1002fff0` is called from `0x100270e0`, `0x10026270`, `0x10025e60` and others). The WDB loader itself only interprets keywords.

## Token reader

| Address                                                                                          | Role                                                                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `0x10032440`                                                                                     | Base reader constructor (vtable `0x100578bc`): clears push-back flag `+0x30`, last token `+0x34`  |
| `0x1002fff0`                                                                                     | Binary reader constructor (vtable `0x1005780c`, 0x650 bytes): clears repeat and macro state       |
| `0x10032670`                                                                                     | Sets the default extension (`strncpy(this + 0x1e8, ext, 5)`); the WDB loader passes `.wdb`        |
| `0x10030070`                                                                                     | vtable `+0x38`: open by name, adds the extension, resets position `+0x1f0` and push-back          |
| `0x10031800`                                                                                     | vtable `+0x24`: `read(offset, buffer, size, bytesRead*)`; returns `0x10` only when 0 bytes remain |
| `0x10030300`                                                                                     | vtable `+0x44`: next token (below)                                                                |
| `0x10030c30`                                                                                     | Reads a macro definition (token `0x16`)                                                           |
| `0x10030da0`                                                                                     | Takes the next token from a repeat, a macro or the array-header table                             |
| `0x10030e40`                                                                                     | vtable `+0x40`: fatal error; message from the table at `0x1005f260` plus `" file %s"`             |
| `0x10032580`                                                                                     | Fatal I/O error ("I/O error occurred file %s"), for read results other than 0 and `0x10`          |
| `0x100326a0`                                                                                     | Read int: next token must be `4`, else error 4                                                    |
| `0x100326c0`                                                                                     | Read float: next token must be `3`, else error 3                                                  |
| `0x100326e0`                                                                                     | Read string: next token must be `2`, else error 2; returns the buffer at `+0x44`                  |
| `0x10032700`                                                                                     | Read string with a maximum length: error 14 when `max < strlen`                                   |
| `0x10032740`                                                                                     | Expect a given token, else error 19                                                               |
| `0x10032760` / `0x10032780` / `0x100327a0` / `0x100327c0`                                        | Expect `[` / `]` / `{` / `}`, else error 7 / 8 / 5 / 6                                            |
| `0x100327e0`                                                                                     | Array count: `[` int `]` `{`, returns the int                                                     |
| `0x1002ff80`, `0x1002ffb0`, `0x1002ffd0`                                                         | Static initialisers: `1.0f / 4096`, `1.0f / 32`, `1.0f / 127` (`127.0f` at `0x10057808`)          |
| `0x1002fba0`, `0x1002fdd0`, `0x10031070`, `0x10031100`, `0x10031140`, `0x100311d0`, `0x10031260` | Writer slots (text and binary); they confirm `9` = `,` and `10` = `;`                             |

### Next token (`0x10030300`)

If the push-back flag is set, clear it and return the last token. Otherwise loop:

1. If the repeat count `+0x1f8` is zero, read one byte; else take a token from `0x10030da0`.
2. Dispatch on the token:

| Token          | Bytes that follow                                                                        | Returns      | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `0x02`         | up to 63 bytes                                                                           | `2`          | string up to the first NUL; position += length + 1                                 |
| `0x03`         | 4                                                                                        | `3`          | float32                                                                            |
| `0x04`         | 4                                                                                        | `4`          | int32                                                                              |
| `0x0b`, `0x0c` | 1                                                                                        | `4`          | unsigned byte (both cases share one code path)                                     |
| `0x0d`         | 2                                                                                        | `4`          | signed short                                                                       |
| `0x0e`         | 2                                                                                        | `4`          | unsigned short                                                                     |
| `0x0f`         | 2                                                                                        | `3`          | signed short × `1/4096`                                                            |
| `0x10`         | 2                                                                                        | `3`          | signed short × `1/32`                                                              |
| `0x11`         | 2                                                                                        | `3`          | signed short as float                                                              |
| `0x12`         | 1                                                                                        | `3`          | unsigned byte × `(float)(1/127)`                                                   |
| `0x13`         | 2                                                                                        | the `uint16` | extended token id                                                                  |
| `0x14`         | `uint16` count, token byte (+`uint16` if `0x13`)                                         | —            | repeat that token `count` times; a macro token repeats the macro, `0x15` the table |
| `0x15`         | —                                                                                        | —            | replays the 4-entry table at `0x100577f8`: `7 4 8 8` (`[` int `]` `]`)             |
| `0x16`         | macro token, length, then `length` token bytes (`0x13` + `uint16` each for extended ids) | —            | defines macro `token - 0x17`                                                       |
| `0x17`–`0x26`  | —                                                                                        | —            | replays that macro once                                                            |
| anything else  | —                                                                                        | itself       | `0` ends the file; `5`–`10` are `{ } [ ] , ;`                                      |

Macros, repeats and the table only produce token ids; value tokens produced that way still read their bytes from the file. A macro is 16 slots of a flat 256-entry table at `+0x210` with lengths at `+0x610`; the original does not bounds-check the macro index or length (the port throws `TokenReaderOverflowError`).

End of file: a read that gets 0 bytes makes the token `0` (and stores `0` as the last token). A read that gets some but fewer bytes than asked is error 0 (Syntax error), except for strings, which take what is there. After a macro definition the loop returns `0` if the _last token_ is `0`, so a file that starts with `0x16` reads as empty (no original file does).

### Error table (`0x1005f260`)

0 Syntax error, 1 Numeric too long, 2 Expected string, 3 Expected float, 4 Expected int, 5 Expected left curly, 6 Expected right curly, 7 Expected left bracket, 8 Expected right bracket, 9 Expected comma, 10 Expected semicolon, 11 Expected EOF, 12 Expected string or bracket, 13 Invalid keyword, 14 Invalid string, 15 Invalid value, 16 Duplicate name, 17 Unsupported, 18 Unexpected keyword, 19 Expected keyword.

## WDB loader

| Address                                                                                                                      | Role                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0x1002c240`                                                                                                                 | Load: with its fourth argument set, builds the binary reader, sets `.wdb` (`0x1005cf18`) and loops over top-level tokens until `0`; tokens without a case are ignored. Otherwise it builds the text token writer (vtable `0x10057744`) whose read slots are stubs (`0x1002c020`, `0x1002fa30`). Afterwards calls vtable `+8`, `+4`, `+0xc` and `0x1002e640`. |
| `0x1002c7b0`, `0x1002c840`, `0x1002c8d0`, `0x1002c960`, `0x1002c9f0`, `0x1002ca80`, `0x1002cb10`, `0x1002cba0`, `0x1002db50` | Name lists `0x27`–`0x2d`, `0x40`, `0x3d`                                                                                                                                                                                                                                                                                                                     |
| `0x1002cc30`                                                                                                                 | Mesh instances (`0x2e`)                                                                                                                                                                                                                                                                                                                                      |
| `0x1002cfa0`                                                                                                                 | Skeleton instances (`0x2f`)                                                                                                                                                                                                                                                                                                                                  |
| `0x1002d400`                                                                                                                 | BSP tree instances (`0x30`)                                                                                                                                                                                                                                                                                                                                  |
| `0x1002d720`                                                                                                                 | BSP volume instances (`0x41`)                                                                                                                                                                                                                                                                                                                                |
| `0x1002d950`                                                                                                                 | Sprites (`0x37`)                                                                                                                                                                                                                                                                                                                                             |
| `0x1002dc80`                                                                                                                 | Cameras (`0x43`)                                                                                                                                                                                                                                                                                                                                             |
| `0x1002df90`                                                                                                                 | Ambient lights (`0x48`)                                                                                                                                                                                                                                                                                                                                      |
| `0x1002e0d0`                                                                                                                 | Directional lights (`0x49`)                                                                                                                                                                                                                                                                                                                                  |
| `0x1002dbe0`                                                                                                                 | Material animation reference list (`0x3e` inside instances)                                                                                                                                                                                                                                                                                                  |
| `0x10017390`, `0x1002e2c0`                                                                                                   | Allocate the runtime objects per section (out of scope)                                                                                                                                                                                                                                                                                                      |
| `0x10017ac0`                                                                                                                 | Loads each name list's files and links sprites; see [scene.md](scene.md)                                                                                                                                                                                                                                                                                     |
| `0x1002e640`, `0x1002e250`                                                                                                   | Link instances to the loaded objects and check references; see [scene.md](scene.md)                                                                                                                                                                                                                                                                          |

Every section starts `keyword [ int count ] {` and ends with `}`. A section seen twice is error 18; a count of zero is error 4. Inside entries an unknown keyword is error 0. An index into another section is error 15 when `count <= (unsigned)index` and `count != 0` (so it is unchecked while that section is still missing).

### Name lists

`count` strings, each copied with `strncpy(dst, s, 8)` into an 8-byte slot. The section's meaning comes from the extension `0x10017ac0` appends when loading it and from the link errors in `0x1002e640`:

| Keyword | World offset | Extension (`0x1005cba4`–`0x1005cbd4`) | Contents                                                |
| ------- | ------------ | ------------------------------------- | ------------------------------------------------------- |
| `0x27`  | `+0x0c`      | `.tdf` → `.TDB` files                 | textures                                                |
| `0x28`  | `+0x14`      | `.mdf` → `.MDB`                       | materials                                               |
| `0x29`  | `+0x1c`      | `.adf` → `.ADB`                       | animations                                              |
| `0x2a`  | `+0x24`      | `.gdf` → `.GDB`                       | meshes ("Illegal mesh reference")                       |
| `0x2b`  | `+0x2c`      | `.gdf`                                | material assignments ("Illegal alt mat assign ref val") |
| `0x2c`  | `+0x34`      | `.sdf` → `.SDB`                       | skeletons ("Illegal skeleton reference")                |
| `0x2d`  | `+0x3c`      | `.bdf` → `.BDB`                       | BSP trees ("Illegal bsp tree reference")                |
| `0x3d`  | `+0x74`      | `.maf` → `.MAB`                       | material animations                                     |
| `0x40`  | `+0x44`      | (`.BVB` files of the same names)      | BSP volumes ("Illegal bsp volume reference")            |

### Instance entries (0x8c bytes each)

Entry header: the section keyword again, an optional string name (anything else is pushed back; name stays empty), then `{`. Fields until `}`:

| Keyword | `0x2e` mesh | `0x2f` skeleton | `0x30` BSP tree | Reads                                                          | Stored at                                                |
| ------- | :---------: | :-------------: | :-------------: | -------------------------------------------------------------- | -------------------------------------------------------- |
| `0x2a`  |      ✓      |                 |                 | int mesh index (checked), float distance                       | next level: `+0x08`, `+0x38`                             |
| `0x2c`  |             |        ✓        |                 | int skeleton, int animation (both checked), float distance     | next level: `+0x14`, `+0x20`, `+0x38` (`+0x08` stays -1) |
| `0x33`  |             |        ✓        |                 | int mesh, int skeleton, int animation, float distance          | next level: `+0x08`, `+0x14`, `+0x20`, `+0x38`           |
| `0x34`  |             |                 |        ✓        | int mesh, int BSP tree, float distance                         | next level: `+0x08`, `+0x14`, `+0x38`                    |
| `0x2b`  |      ✓      |        ✓        |        ✓        | int material assignment (checked), int slot (`> 2` → error 15) | `+0x2c + 4·slot`                                         |
| `0x31`  |      ✓      |        ✓        |        ✓        | 3 floats                                                       | `+0x50` position                                         |
| `0x32`  |      ✓      |        ✓        |        ✓        | 6 floats                                                       | `+0x5c` forward, `+0x68` up                              |
| `0x35`  |             |        ✓        |                 | string (→ index -1, name) or int (→ index, empty name)         | `+0x44`, `+0x48`                                         |
| `0x36`  |      ✓      |        ✓        |                 | float                                                          | `+0x74`                                                  |
| `0x3e`  |      ✓      |        ✓        |        ✓        | list of 4 ints per entry (`0x1002dbe0`); twice is error 18     | `+0x78`, `+0x7c`                                         |
| `0x3f`  |      ✓      |        ✓        |        ✓        | 2 floats; sets flag 8                                          | `+0x80`, `+0x84`, `+0x88`                                |
| `0x42`  |      ✓      |        ✓        |        ✓        | sets flag 2                                                    | `+0x88`                                                  |
| `0x4c`  |      ✓      |        ✓        |                 | sets flag 4                                                    | `+0x88`                                                  |

Defaults: material assignment slots `-1`; mesh slots `-1`; skeleton slots `-1` (`0x2f`); forward `(1,0,0)`; up `(0,0,1)`; `0x36` value `1.0`; `0x2f` field `+0x44` `-1`. A negative distance is stored as `FLT_MAX` (`0x100576e4`). Levels are appended with no bound check (the port throws past three). `0x1002e640` squares distances below `0x10057330` and uses a level's material assignment slot of the same index, so the slot is the level index; a material animation reference's fourth int also selects a level.

### BSP volume instances (`0x41`, 0x8c bytes)

Same header. `0x2b` int material assignment (checked) at `+0x2c` (default -1), `0x31` position, `0x32` orientation, `0x40` int BSP volume index at `+0x14` (stored, then checked).

### Sprites (`0x37`, 0x38 bytes)

`0x37 {` with no name. `0x39` string → material name at `+0x00`; `0x31` position `+0x08`; `0x38` 3 floats `+0x14` (flag 2 in byte `+0x2c`); `0x3a` float `+0x20`; `0x3b` float `+0x24`; `0x3c` float `+0x28` (default `FLT_MAX`, `0x100576e8`); `0x2b` two ints stored as shorts `+0x34`, `+0x36` (flag 4); `0x3e` two ints as shorts `+0x2e`, `+0x30` (byte `+0x32` = 1). `0x10017ac0` needs either the material name ("Sprite is missing material name") or the `0x2b` material assignment ("Illegal mat assign reference").

### Cameras (`0x43`, 0x4c bytes)

Same header as instances. `0x2f` int skeleton instance index (checked against the `0x2f` section) `+0x08`, int `+0x0c`; `0x31` position `+0x1c`; `0x32` forward `+0x28`, then three floats stored **negated** at `+0x34`; `0x35` as in skeleton instances at `+0x10`/`+0x14`; `0x44` 3 floats target, after the block `forward = target - position`; `0x45`/`0x46`/`0x47` floats `+0x40`/`+0x44`/`+0x48`. Defaults: `+0x08` -1, forward `(1,0,0)`, negated up `(0,0,-1)`, `0x45` 1.0, `0x46` 100.0, `0x47` 65.0.

### Lights (`0x48` ambient, `0x49` directional; 16 bytes)

Header reads and discards an optional name. `0x4a`: three ints, each stored as a byte, fourth byte `0xff`. `0x49` also takes `0x4b`: 3 floats at `+0x04`.

## Naming

Section names come from the evidence above. Keywords that the loader only copies into runtime objects (`0x35`, `0x36`, `0x38`, `0x3a`–`0x3c`, `0x3f`, `0x42`, `0x45`–`0x47`, `0x4c`) keep neutral names (`keyword36Value`, ...) until the code that uses them is ported. "Camera", "ambient light" and "directional light" also match the names in the files (`Camera01`, `amb0`, `Direct01`).
