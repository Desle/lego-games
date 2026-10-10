# Animation (`.ADB`)

Source: `GolDP.dll` (the exe has its own copy at `0x00401260`, not ported here). Read with the token reader (`token-reader.md`); default extension `.adb` (`0x1005cbdc`). The world creates the object (class `0x100187e0`, vtable `0x10056a50`) in `World_CreateResources` (`0x10017390`). The English `LEGO.JAM` holds 421 `.ADB` files; all parse and end exactly at their last byte (each is `0x27`, `0x2b`, `0x2c` in that order).

| Address      | Role                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| `0x100188e0` | Loader (vtable slot 5): sections until the end of the file; other tokens are error 0       |
| `0x100241d0` | Keyword `0x27` block (object at `+0xc`)                                                    |
| `0x10018a80` | Keyword `0x2b` (vtable `+0xc`): 20-byte entries at `+0x24`, count `+0x28`                  |
| `0x10018b40` | Keyword `0x2c` (vtable `+0x10`): 40-byte entries at `+0x2c`, count `+0x30`, new name table |
| `0x10018640` | `0x2c` entry constructor (defaults)                                                        |
| `0x10018670` | `0x2c` entry body                                                                          |
| `0x10018790` | Uses `+0x26` of an entry as an unsigned 16-bit bound on a float (wraps the value)          |

Each list keeps the last one read.

## Keyword `0x27` (`0x100241d0`)

```
0x27 {
  ( 0x28 [ n ] { (3 floats) × n }      n = 0 → error 4; at +0xc, count +0
  | 0x29 [ n ] { (4 floats) × n }      at +0x10, count +4
  | 0x2a [ n ] { int × n } )…          int16 at +0x14, count +8
}                                      other token → error 0
```

## Keyword `0x2b` (`0x10018a80`)

```
0x2b [ n ] { (int int int int int int) × n }    n = 0 → error 4
```

Stored at `+0`, `+4`, `+0x10` (int16), `+8`, `+0xc`, `+0x12` (int16), in that file order.

## Keyword `0x2c` (`0x10018b40`, `0x10018670`)

```
0x2c [ n ] {                         n = 0 → error 4
  ( 0x2c "name" { keyword… } ) × n   missing 0x2c → error 19; name of any length,
}                                    keyed on 8 chars, repeat fatal
```

Defaults (`0x10018640`): all zero, except `+0x1c` = `0x7effffff` (float32 2^127 − 2^103).

| Token  | Operands                 | Stored at                                   |
| ------ | ------------------------ | ------------------------------------------- |
| `0x2b` | int                      | `+0x20`                                     |
| `0x2d` | int token (else error 4) | `+0x24` int16                               |
| `0x2e` | int token (else error 4) | `+0x26` uint16                              |
| `0x2f` | int                      | `+0` = `(float)int × 0.001f` (`0x10056a4c`) |
| `0x30` | 3 floats                 | `+4..+0xc`                                  |
| `0x31` | 4 floats                 | `+0x10..+0x1c`                              |
| other  |                          | error 0                                     |

The port scales `0x2f` as `fround(value × fround(0.001))`, which equals the x87 result for `|value| < 2^29` whatever the precision control; larger values are refused.

## Unknown fields

Every list: `keyword28Triples`, `keyword29Quadruples` (unit quaternions in the data), `keyword2aValues`, `keyword2bEntries`, and the `0x2c` entries' `keyword2bValue`, `keyword2dValue`, `keyword2eValue`, `keyword2fValue`, `keyword30Values`, `keyword31Values`. The `0x2c` entry names match the skeleton's bone names in the data.

What the fields mean (rate, velocity, frame counts, tracks, key pools) and how they are sampled: `skeletal-animation.md`.
