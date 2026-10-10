# String table (`.SRF`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/string-table`.

`StringTable_Load` (`0x0044e2c0`, vtable `0x004b0ff4`) reads through the JAM stream, not the token reader:

```
0x00  uint16 stringCount          -> table +0x10
0x02  uint16 characterCount
0x04  uint16 offsets[stringCount]  -> table +0x0c (in characters)
      uint16 characters[characterCount] -> table +0x08, read at 4 + 2 * stringCount
```

Each integer is reassembled from bytes (little-endian). A short read makes the load return 0.

`StringTable_GetString` (`0x0044e540`) returns `characters + offsets[index]`, and 0 when the characters are missing or `index > stringCount`. The test is `>`, so `index == stringCount` reads one offset past the array; the port throws `StringTableOverreadError` there and for a string without a terminating 0.

Callers include the load screen (`0x0042f480`, caption index from LSB keyword `0x2a`) and the race HUD (`0x00427310`).

Verified: all 181 `.SRF` files in `LEGO.JAM` are consumed exactly and every string has its terminator.
