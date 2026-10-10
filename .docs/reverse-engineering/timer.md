# Timers (`.TIB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/timer`.

`Timers_Load` (`0x00464aa0`, race `+0x213c`, `RET 0x10`, no mirror):

```
0x27 [ count                     // every bracket through 0x0044e8a0 (error 19)
                                 // count 0: the reader closes; "] { }" stays unread
] {
(0x27 { keywords }) * count      // the final "}" is never read
```

| Keyword | Values                                                             | Timer offset (`0x24` bytes, `Timer_Setup` `0x00464750`) |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `0x28`  | `0x2b` int (sets flag 2), or any value token whose integer is kept | `+0x10`                                                 |
| `0x29`  | `0x2b` int (sets flag 4), or a value token                         | `+0x14`                                                 |
| `0x2a`  | int, default -1                                                    | `+0x20`                                                 |
| `0x2d`  | int, default 0                                                     | `+0x18`                                                 |

Anything else is error 0. Flags (`& ~1`) go to `+0x1c`.

`Timer_Setup` (`0x00464750`): with flag 4 the second value is replaced by one random-table draw — `draw % value` when `value < 0x400` (unsigned), else `draw * (value / 0x3ff)`. When `+0x18` is 0 it starts the timer with that value (`0x00464a40`). A randomised value of 0 divides by zero; the port throws.

Unknown: what flag 2 does, and the roles of the values (in the data, `0x2a` looks like an event number).

Verified: all 14 `.TIB` files parse up to the bytes the loader never reads (`] { }` for the 9 empty files, `}` for the others).
