# Skeleton (`.SDB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.sdb` (`0x1005cef8`). Root slot 6 creates the object (vtable `0x1005672c`). The English `LEGO.JAM` holds 417 `.SDB` files; all parse and end exactly at their last byte (each has one `0x27` block).

| Address      | Role                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `0x10029a20` | Loader: `0x27` blocks until the end of the file; any other top-level token is error 0              |
| `0x10029c60` | Reads one block                                                                                    |
| `0x100149a0` | Skeleton vtable `+0xc`: allocates `count` bones of `0xd0` bytes (replacing earlier ones)           |
| `0x10002890` | Bone constructor: identity matrices                                                                |
| `0x10003000` | Bone vtable `+0x44`: position → `+0x40..+0x48`                                                     |
| `0x10002e30` | Bone vtable `+0x2c`: normalises the quaternion (x, y, z, w) and writes the rotation matrix         |
| `0x100283e0` | Name lookup (≤ 8 chars) in the skeleton's name table                                               |
| `0x1001ceb0` | Links a bone as child of another (child `+4` parent, `+8` next sibling; parent `+0xc` first child) |

## Layout

```
( 0x27 [ count ] {                  count = 0 → error 4; a new name table each block
    ( 0x27 "name" { keyword… } ) × count     name ≤ 8 chars, repeated name fatal
  } )…                              until end of file
```

Keywords inside a bone, until `}`:

| Token  | Operands   | Effect                                                                                     |
| ------ | ---------- | ------------------------------------------------------------------------------------------ |
| `0x28` | 3 floats   | position                                                                                   |
| `0x29` | 4 floats   | quaternion x, y, z, w                                                                      |
| `0x2a` | string ≤ 8 | parent: looked up among names added so far (the bone's own included); not found → error 14 |
| other  |            | ignored (no error); end of file here makes the original loop forever — the port refuses it |

A second block replaces the bones and the name table; the port keeps the last block. A repeated `0x2a` relinks the bone without unlinking it from the earlier parent; the port keeps the last parent index.

Bone matrices, posing and animation sampling: `skeletal-animation.md`.
