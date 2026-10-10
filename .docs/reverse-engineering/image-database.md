# Image database (`.IDB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.idb` (`0x1005ce04`). Root slot 13 creates the object; menus load it through `0x0046b6e0` in the exe. The English `LEGO.JAM` holds 23 `.IDB` files; all parse and end exactly at their last byte.

| Address      | Role                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `0x10023060` | Loader; jump table `0x1002338c` (keywords `0x28`..`0x2c`, disassembled `0x1002322c`..`0x100232a5`) |
| `0x10028ad0` | Links the database into its owner before reading                                                   |
| `0x100282c0` | Adds the name; a repeated name (first 8 chars) is fatal: `<name>: Duplicate name encountered`      |

## Layout

```
0x27 [ count ] {                    count = 0 → stop here (the `}` is not read)
  ( 0x27 "name" { keyword… } ) × count     name ≤ 8 chars (else error 14)
}                                           nothing after this is read
```

Each image starts from flags 0, bytes A `00 00 00` and bytes B `ff ff ff` (the fourth byte of both is `0xff`, set once at `0x100231b1`). Keywords until `}`:

| Token  | Operands | Effect                      | Stored at                     |
| ------ | -------- | --------------------------- | ----------------------------- |
| `0x28` | —        | set flag 4                  |                               |
| `0x29` | —        | clear flag 0x10, set flag 8 |                               |
| `0x2a` | —        | clear flag 8, set flag 0x10 |                               |
| `0x2b` | 3 ints   | set flag 0x20; bytes A      | `+0x28` when flag 0x20 is set |
| `0x2c` | 3 ints   | bytes B                     | `+0x4a`                       |
| other  |          | error 0                     |                               |

After `}` (`0x100232b8`): name at `+0x42`; flag `0x40` when device method `+0x110` returns non-zero; flag `0x80` when `0x20` is set and device `+4` has bit `0x200`; flags at `+0x40` (uint16), then with 0x800 set when 0x20 is set. The port leaves out `0x40` and `0x80` (device-dependent).

## Unknown fields

`keyword2bBytes` (bytes A), `keyword2cBytes` (bytes B) and the flags `4`, `8`, `0x10`, `0x20` are not identified.
