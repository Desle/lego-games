# BSP tree (`.BDB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.bdb` (`0x1005cc80`). Root slot 7 creates the object (vtable `0x10056b68`); worlds name these files under keyword `0x2d` ("Illegal bsp tree reference"). The English `LEGO.JAM` holds 14 `.BDB` files; all parse and end exactly at their last byte, and in every one each branch's children name that branch as their parent.

| Address      | Role                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `0x1001ae50` | Loader: sections until the end of the file; other tokens are error 0 |
| `0x1001b010` | Nodes (`0x27`): 32-byte nodes at `+8`, root pointer at `+0xc`        |
| `0x1001b1a0` | Keyword `0x2a`: 24-byte entries at `+0x18`, count `+0x14`            |
| inline       | Keyword `0x2b`: int16 values at `+0x20`, count `+0x1c`               |

A repeated section allocates again and replaces the earlier one.

## Nodes (`0x1001b010`)

```
0x27 [ count ] {                     count = 0 → error 4
  ( 0x28 parent child child f f f f
  | 0x29 parent int int int int int ) × count     other token → error 0
}
```

Every index is read as an int; a negative one is stored as `0xffff` (-1), anything else as its low 16 bits. A node whose parent is negative becomes the root (`+0xc`); the root starts as node 0.

| Offset           | `0x28` (branch, word +0 = 0)              | `0x29` (leaf, word +0 = 1)               |
| ---------------- | ----------------------------------------- | ---------------------------------------- |
| `+2`             | parent                                    | parent                                   |
| `+4`             | float 1                                   | int (2nd value)                          |
| `+8`             | float 2                                   | int (3rd value)                          |
| `+0xc`           | float 3                                   | —                                        |
| `+0x10`          | float 4                                   | —                                        |
| `+0x14`, `+0x18` | 0                                         | `+0x18` int16 (5th), `+0x1a` int16 (6th) |
| `+0x1c`          | first child                               | int16 (4th value)                        |
| `+0x1e`          | second child; both children -1 → error 17 | —                                        |

## Other sections

```
0x2a [ count ] { (6 floats) × count }     count = 0 → error 4; loop compares signed
0x2b [ count ] { int × count }            count = 0 → error 4; stored as int16; signed loop
```

## Traversal (draw, `FUN_100092a0`)

A BSP tree instance draws through root slot `+0x90`. Node layout at run time (32 bytes): word `+0` kind, `+2` parent, branch `+4`..`+0x10` plane (normal, offset), `+0x1c` / `+0x1e` children; leaf `+4` first draw command, `+8` command count, `+0x1c` volume index (negative: none), `+0x18` offset and `+0x1a` count into the `0x2b` list; `+0x1e` of a visited leaf is its clip flag.

| Address      | Role                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x100092a0` | Per instance: level and sphere test through the scene object, then `0x1001b2c0`, then each listed leaf through `0x10006e00` (its command run) with the clip matrix (`+0xc8498`) when the leaf's flag is set, else the unclipped one (`+0xc84d8`)           |
| `0x1001b2c0` | Finds the leaf holding the camera: `((nz * z + ny * y) + nx * x) + d < 0` and a second child present goes to the second child, otherwise to the first (the second when the first is missing). With keyword `0x2b` data (every race file) it hands over to `0x1001b640` |
| `0x1001b640` | The camera leaf first (flag set), then every leaf of its visibility list: no volume = drawn with the flag set, else `0x1002bc90` decides (0 skip, 2 flag cleared, 1 flag set)                                                                              |
| `0x1002bc90` | Frustum (six planes at `+0x6c`) against a volume (`0x2a` entry: minimum corner, maximum corner): 0 all eight corners behind one plane, 1 some corner behind a plane, 2 inside                                                                              |

The stackless walk of the rest of `0x1001b2c0` (stamps at `+0x14` / `+0x18`) runs only for a tree without `0x2b` data; none of the 14 files lacks it, so it is not ported. The leaves' commands are the model's command words (`0x10027430` order), each run starting with a material selection. Ported as `getVisibleBspLeaves` in `bsp-tree`; the field names `keyword28Floats` (plane), `keyword29Values` (first command, command count, volume index, list offset, list count), `keyword2aEntries` (volumes) and `keyword2bValues` (visibility list) keep their keyword names in the data types.
