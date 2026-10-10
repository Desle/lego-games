# Start positions (`.SPB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/start-position`.

`RacerSet_LoadStartPositions` (`0x0043bc10`, arguments name, JAM, mirror; `RET 0xc`):

```
0x27 [ count ] {
  (0x27 slot { keywords }) * count   // counted down to 0
}
```

| Keyword | Values   | Racer set offset                         | Mirror             |
| ------- | -------- | ---------------------------------------- | ------------------ |
| `0x28`  | 3 floats | `+0x194 + 0xc·slot`                      | negate 2nd         |
| `0x29`  | 6 floats | `+0x1dc + 0xc·slot`, `+0x224 + 0xc·slot` | negate 2nd of each |

Any other keyword is error 0. The slot is not range-checked (six slots fit each array). Port names: `position`, `firstAxis`, `secondAxis` (role of the two vectors not confirmed; in the data they are unit vectors).

Verified: all 14 `.SPB` files parse to their last byte.
