# BSP volume (`.BVB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.bvb` (`0x1005cc88`). The world allocates the 100-byte objects (`World_AllocateVolumes` `0x1002e2c0`) and names them under keyword `0x40` ("Illegal bsp volume reference"). The English `LEGO.JAM` holds 45 `.BVB` files; all parse and end exactly at their last byte.

| Address      | Role                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| `0x1001b800` | Loader: sections until the end of the file; other tokens are error 0                        |
| `0x10025f90` | Material names (`0x27`), at `+0x18`                                                         |
| `0x1002be00` | Vector list constructor (12 bytes, vtable `0x100576a8`) for `0x34`                          |
| `0x1002be90` | Vector list vtable `+8`: reads the vectors                                                  |
| `0x1001bb10` | Keyword `0x2d`: 8-byte entries at `+0x14`, count `+0x10`                                    |
| `0x1001bbb0` | Keyword `0x8b`: 20-byte nodes at `+8`, count `+4`                                           |
| `0x1001bd00` | Keyword `0x8e`: same nodes, fixed point                                                     |
| `0x1001be50` | After the file, when there are nodes: walks them and returns the deepest path + 1 (`+0x28`) |
| `0x10028c20` | Material lookup; failure → `Material assignment failed` (fatal, not ported)                 |

## Sections

```
0x27 [ count ] { string × count }     second 0x27 → error 18; count = 0 → error 4;
                                      strings of any length (0x100326e0), compared over 8 chars;
                                      closing token must be `}` (error 6)
0x34 [ count ] { (3 floats) × count } second 0x34 → error 18; count kept as int16, 0 → error 4
0x2d [ count ] { (4 ints) × count }   count = 0 → error 4; stored as int16
0x8b [ count ] { node × count }       count = 0 → error 4
0x8e [ count ] { node × count }       count = 0 → error 4
```

A repeated `0x2d`, `0x8b` or `0x8e` replaces the earlier one; `0x8b` and `0x8e` fill the same nodes.

### Nodes (20 bytes)

| Offset           | `0x8b` (`0x1001bbb0`)                                                                      | `0x8e` (`0x1001bd00`)                                                               |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `+0x10`, `+0x12` | two child tokens: int → low 16 bits, `0x8c` → `0xffff`, `0x8d` → `0xfffe`, other → error 0 | two ints: ≥ 0 → low 16 bits, -1 → `0xffff`, -2 → `0xfffe`, other negative → error 0 |
| `+0`..`+8`       | 3 floats, then a 4th float that is read and dropped                                        | 3 ints × float32 2^-30 (`0x10056c38`)                                               |
| `+0xc`, `+0xe`   | 2 ints as int16                                                                            | 2 ints as int16                                                                     |

`0x1001be50` follows `+0x12` then `+0x10` and descends into neither `0xffff` nor `0xfffe`, which is why the two are child indices.

## Unknown fields

`keyword34Vectors`, `keyword2dEntries`, the node `vector` (three components; a unit vector in the data) and `shortValues`, and what `0xffff` versus `0xfffe` means for a child.
