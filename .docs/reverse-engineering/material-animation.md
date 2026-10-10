# Material animation (`.MAB`)

Source: `GolDP.dll` (the exe has its own copy at `0x0040fed0`, not ported here). Read with the token reader (`token-reader.md`); default extension `.mab` (`0x1005ce30`). The world creates the object (`0x10025890`, vtable `0x10057034`) in `World_CreateResources` (`0x10017390`). The English `LEGO.JAM` holds 42 `.MAB` files; all parse and end exactly at their last byte.

| Address      | Role                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `0x100258f0` | Loader: the materials section, then the entries section; nothing else is read                                              |
| `0x10025a40` | Materials: 8-byte entries at `+4`, count `+8`                                                                              |
| `0x10026110` | Looks the material up (`0x10028c20`); failure → `Unable to find named material: <name>` (fatal, not ported); value at `+4` |
| `0x10025b60` | Entries: 24-byte entries at `+0xc`, count `+0x10`                                                                          |
| `0x10025d40` | Fills an entry                                                                                                             |

## Layout

```
0x27 [ n ] {                     missing 0x27 → error 19; n = 0 → error 15
  ( "name" int ) × n             name ≤ 8 chars (else error 14)
}                                closing token must be `}` (error 6)
0x28 [ n ] {                     missing 0x28 → error 19; n = 0 → error 15
  ( 0x28 { keyword… } ) × n      missing 0x28 or `{` → error 5
}                                closing token must be `}` (error 6)
```

Entry defaults: `0x27` values 0 and 1, `0x29` value 1, `0x2a` value 30. Keywords until `}`:

| Token  | Operands | Stored at (`0x10025d40`)                      |
| ------ | -------- | --------------------------------------------- |
| `0x27` | 2 ints   | `+6`, `+8` (int16)                            |
| `0x29` | int      | `+0xa` (int16)                                |
| `0x2a` | int      | `+0xc` = `(float)int × 0.001f` (`0x100570b8`) |
| other  |          | error 0                                       |

`0x10025d40` also clears `+0x10` and sets `+0x14` to 1. The `0x2a` scaling is exact in the port for `|value| < 2^29`; larger values are refused.

## Unknown fields

The material entry's `value`, and every entry field: `keyword27Values`, `keyword29Value`, `keyword2aValue`.
