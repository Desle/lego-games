# Texture database (`.TDB`)

Source: `GolDP.dll`. Read with the token reader (`token-reader.md`); default extension `.tdb` (`0x1005cf10`). Root slot 3 creates the object. The English `LEGO.JAM` holds 162 `.TDB` files; all parse, and every one ends exactly at its last byte except `GAMEDATA\COMMON\DBRICKS.TDB`, whose count is 0: the loader stops after `{` and leaves the final `}` unread.

| Address      | Role                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `0x1002b5a0` | Loader; jump table `0x1002b86c` (keywords `0x28`..`0x2e`)                                                                        |
| `0x10028b30` | Links this database into the world's chain (world `+0x38`, next at `+0x10`) before anything is read                              |
| `0x10028b90` | Searches every database of the world chain (this one included) with `0x100283e0`                                                 |
| `0x10028250` | Allocates the name table (count × 12 bytes); `0x100282c0` adds a name, `0x100283e0` finds one (hash over ≤ 8 chars, `strncmp` 8) |
| `0x1002b890` | Post-processing when `0x1005cf0c` is set (not ported)                                                                            |

## Layout

```
0x27 [ count ] {                    count = 0 → stop here (the `}` is not read)
  ( 0x27 "name" { keyword… } ) × count     name ≤ 8 chars (else error 14)
}                                           nothing after this is read
```

Before `{` the name is searched in the world chain (`0x1002b718`). Found: the name is **not** added and its first byte is set to 0 (`0x1002b721`), so the texture keeps a blank name; not found: `0x100282c0` adds it. A repeated name is therefore never an error. The port reports `isNameRegistered: false` for a name an earlier texture of the same file already has (earlier databases of the world are out of its reach).

Each texture starts from flags 0, value 0, bytes `00 00 00`. Keywords until `}`:

| Token  | Operands | Effect                      | Stored at                    |
| ------ | -------- | --------------------------- | ---------------------------- |
| `0x28` | —        | set flag 4                  |                              |
| `0x29` | int      | set flag 1; value           | `+0x34` int16                |
| `0x2a` | —        | clear flag 0x10, set flag 8 |                              |
| `0x2b` | —        | clear flag 8, set flag 0x10 |                              |
| `0x2c` | 3 ints   | set flag 0x20; low bytes    | `+0x30..+0x32` (`+0x33` = 0) |
| `0x2d` | —        | set flag 0x100              |                              |
| `0x2e` | —        | set flag 0x200              |                              |
| other  |          | error 0                     |                              |

After `}`: flags with 0x800 set, stored at `+0x36` (uint16), the name's 8 bytes at `+0x38`.

## Unknown fields

The meaning of every flag, of the `0x29` value (`keyword29Value`) and of the `0x2c` bytes (`keyword2cBytes`) is not identified.
