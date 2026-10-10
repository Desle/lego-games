# Particle emitters (`.EMB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/emitter`.

`Emitters_Load` (`0x00489af0`, race `+0x2150` and `+0x248c`, also `0x004a1240`; no mirror argument):

```
0x27 [ count ] {
(0x27 "name" { keywords }) * count   // 0x0048a130; names ≤ 8, registered with 0x00411870
}                                    // read only for a non-zero count
```

Emitter object `0x44` bytes, reset by `0x0048a0e0` (zeros, `+0x1c` = `+0x20` = 1.0, `+0x34` = -1).

| Keyword                  | Values                                | Offset                        | Port field                 |
| ------------------------ | ------------------------------------- | ----------------------------- | -------------------------- |
| `0x28`                   | float → `_ftol`                       | `+0x14`                       | `firstTruncatedValue`      |
| `0x29`                   | float → `_ftol`, low byte             | `+0x18`                       | `secondTruncatedValue`     |
| `0x2a`                   | 3 floats                              | `+0x08`..`+0x10`              | `vector`                   |
| `0x2b`                   | `[ n ] {` 3n floats `}`               | `+0x00` points, `+0x04` count | `points`                   |
| `0x2c`                   | float                                 | `+0x1c`                       | `firstFloat`               |
| `0x2d`                   | float                                 | `+0x20`                       | `secondFloat`              |
| `0x2e`                   | int → pointer `param +0xc + 0x18·n`   | `+0x38`                       | `entryIndex`               |
| `0x2f`                   | int                                   | `+0x30`                       | `firstInteger`             |
| `0x30`                   | int                                   | `+0x34`                       | `secondInteger`            |
| `0x31` / `0x32` / `0x33` | float                                 | `+0x24` / `+0x28` / `+0x2c`   | `thirdFloat`..`fifthFloat` |
| `0x34`                   | name ≤ 8, looked up with `0x00413200` | `+0x40`                       | `linkedName`               |
| `0x35`                   | int, low byte                         | `+0x19`                       | `thirdInteger`             |

Anything else is error 0. Every field name is neutral; their roles in the particle system are not recovered.

Verified: all 17 `.EMB` files parse to their last byte, except the two empty lists whose `}` the loader never reads.
