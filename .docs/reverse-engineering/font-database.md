# Font database (`.FDB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.fdb` (`0x1005cc90`). Root slot 14 creates the object. The English `LEGO.JAM` holds 20 `.FDB` files; all parse and end exactly at their last byte.

| Address      | Role                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `0x1001d8f0` | Loader; jump table `0x1001dd04` (keywords `0x28`..`0x2d`, disassembled `0x1001dad5`..`0x1001dc49`) |
| `0x1001dd20` | Character list reader                                                                              |
| `0x100282c0` | Adds the name; a repeated name (first 8 chars) is fatal                                            |
| `0x1002f9b0` | Called per character list with the count + 1; returning 0 is fatal (not ported)                    |
| `0x1001df80` | After the file: builds each font from the image database (not ported)                              |

## Layout

```
0x27 [ count ] {                    count = 0 → stop here (the `}` is not read)
  ( 0x27 "name" { keyword… } ) × count     name ≤ 8 chars (else error 14)
}                                           nothing after this is read
```

Each font starts from flags 0, bytes A `00 00 00`, bytes B `ff ff ff` (fourth byte `0xff` for both). Keywords until `}`:

| Token  | Operands       | Effect                      | Stored at                                               |
| ------ | -------------- | --------------------------- | ------------------------------------------------------- |
| `0x28` | —              | clear flag 0x10, set flag 8 |                                                         |
| `0x29` | —              | clear flag 8, set flag 0x10 |                                                         |
| `0x2a` | 3 ints         | set flag 0x20; bytes A      | `+0x38` when flag 0x20 is set                           |
| `0x2b` | character list | characters                  | per-font table (`+0x1c`, count `+0x20` of the database) |
| `0x2c` | int            | value                       | font `+0x20`                                            |
| `0x2d` | 3 ints         | bytes B                     | `+0x3c`                                                 |
| other  |                | error 0                     |                                                         |

After `}`: flags at `+0x2c`, with 0x800 set when 0x20 is set; name at `+0x30`.

### Character list (`0x1001dd20`)

```
[ ( string | int )… ]
```

The first token must be `[` (else error 7). Until `]`: a string longer than one character is error 0, its character (unsigned byte; an empty string gives 0) is stored; an int outside `0..0xffff` is error 0; any other token is error 0. Characters are 16-bit and collected in a 200-byte stack buffer of the loader (`ESP+0x34`), so more than 100 overwrite the stack; the port refuses them (`UnportableFileError`). The longest list in the game has 62.

## Unknown fields

`keyword2aBytes`, `keyword2cValue` (null when absent: the font object's constructor value is not read here) and `keyword2dBytes`, and the flags `8`, `0x10`, `0x20`.
