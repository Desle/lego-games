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

## Unknown fields

`keyword28Floats` (the four branch floats; they look like a plane normal and distance in the data, not confirmed in code), `keyword29Values` (the leaf's five values), `keyword2aEntries` and `keyword2bValues`. The child indices are named from the data check above, not from traversal code.
