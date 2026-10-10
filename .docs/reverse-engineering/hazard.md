# Hazards (`.HZB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/hazard`.

`Hazards_Load` (`0x0048a4d0`, race `+0x2148`, arguments set-up structure, name, JAM; `RET 0xc`). The structure is built at `0x00433a3e`..`0x00433b19`; its `+0x40` is the mirror flag.

```
0x27 [ count ]              // count 0: the reader closes, "}" stays unread
{ hazard * count }          // each: one keyword, then that class's loader (vtable +0x10)
```

| Keyword | Class (constructor, vtable) | Loader       | Reads                                                                                                                                                    |
| ------- | --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x28`  | `0x0048b890`, `0x004b42b8`  | `0x0048b920` | nothing (`piltop`, `pilcol`)                                                                                                                             |
| `0x29`  | `0x0048c020`, `0x004b433c`  | `0x0048c0c0` | nothing (`sphinx`, `blowup`)                                                                                                                             |
| `0x2a`  | `0x0048cff0`, `0x004b4434`  | `0x0048d080` | nothing (`rkhamm02`)                                                                                                                                     |
| `0x2b`  | `0x0048c850`, `0x004b43dc`  | `0x0048c960` | nothing (`ghostly`, `gtrail`)                                                                                                                            |
| `0x2c`  | `0x0048d7f0`, `0x004b44e0`  | `0x0048d8e0` | nothing (`mmlavbl`)                                                                                                                                      |
| `0x2d`  | `0x0048d240`, `0x004b447c`  | `0x0048d300` | nothing (`mmcode1..3`)                                                                                                                                   |
| `0x2e`  | `0x0048e2a0`, `0x004b456c`  | `0x0048e3a0` | nothing (`mmrocc`, `mmrocof`, `mmrocon`)                                                                                                                 |
| `0x2f`  | `0x0048e980`, `0x004b4624`  | `0x0048ea50` | nothing                                                                                                                                                  |
| `0x30`  | `0x0048e680`, `0x004b45e0`  | `0x0048e710` | nothing (`dp_def`)                                                                                                                                       |
| `0x32`  | `0x0048fe30`, `0x004b4734`  | `0x0048ff50` | nothing (`crane`, `crneshd`)                                                                                                                             |
| `0x33`  | `0x0048f6e0`, `0x004b46c8`  | `0x0048f830` | `{ 0x37 / 0x38 / 0x39` 3 floats, `0x3a` float (stored squared), `0x3b` int `}`; mirror negates the y of the three vectors (`cannonb`)                    |
| `0x34`  | `0x0048ed10`, `0x004b4654`  | `0x0048ee00` | `{ 0x3b` int, `0x41` name, `0x42` name (four-slot stack buffer) `}`                                                                                      |
| `0x36`  | `0x0048b080`, `0x004b41c4`  | `0x0048b110` | name, float, float (no braces)                                                                                                                           |
| `0x3d`  | `0x0048f200`, `0x004b4684`  | `0x0048f2b0` | `{`, then until `0x33`: `0x37` / `0x38` `[ n ] {` n × (3 floats, int) `}` (y negated when mirrored; other tokens skipped), then the `0x33` block and `}` |
| `0x3e`  | `0x0048bb00`, `0x004b42f0`  | `0x0048bbf0` | `{` name, int, float, 3 floats `}`                                                                                                                       |
| `0x3f`  | `0x0048b2f0`, `0x004b423c`  | `0x0048b380` | nothing                                                                                                                                                  |
| `0x40`  | `0x0048b480`, `0x004b4274`  | `0x0048b580` | `{ 0x37` 3 floats (y negated when mirrored), `0x3b` int, `0x42` name, `0x46` int, `0x47` 3 floats `}`                                                    |
| `0x43`  | `0x0048c440`, `0x004b4370`  | `0x0048c530` | `{ 0x3b` int, `0x42` name, `0x44` int, `0x45` name `}`                                                                                                   |
| `0x48`  | `0x0048dd20`, `0x004b4518`  | `0x0048de10` | `{ 0x3b` int, `0x42` name and 3 floats (stored `+0x50`, `+0x48`, `+0x4c`) `}`                                                                            |
| `0x49`  | `0x0048ae80`, `0x004b4194`  | `0x0048af10` | nothing                                                                                                                                                  |

Names are ≤ 8 characters. Inside a block, an unknown keyword is error 0. Any other hazard keyword leaves the slot null and the loader calls through it (crash); a fifth `0x42` name in `0x34` overruns the stack; a `0x3d` hazard that reaches the end of the file loops forever. The port throws `UnportableFileError` for all three. The model names in brackets come from the loaders and are hints only; the port names classes by keyword.

Verified: all 14 `.HZB` files parse to their last byte, except the two empty lists whose `}` is never read.
