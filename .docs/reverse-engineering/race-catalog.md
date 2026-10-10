# Race catalog (`LEGORACE.RCB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/race-catalog`. The catalog names the races of each circuit ([circuit-database.md](circuit-database.md)) and the folder of each race below `GAMEDATA`.

`RaceCatalog_Load` (`0x004366f0`, from the front end `FUN_0042d1e0`) reads `legorace.rcb` and fills a table of 0x38-byte records through `FUN_004364f0`:

```
0x27 [ count ] {
  (0x27 name { keyword value ... }) * count     // name: string of at most 8 characters, the key
}
```

| Keyword | Value                    | Record  | Port field    | Meaning                                                                                                    |
| ------- | ------------------------ | ------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `0x28`  | integer                  | `+0x28` | `raceNumber`  | The race's index in its circuit; the loader stores the record at `circuit +0x48 + 4 · number` (four slots) |
| `0x29`  | name ≤ 8                 | `+0x0c` | `firstName`   | The race's folder: `racec0r0` is `GAMEDATA\RACEC0R0`                                                       |
| `0x2a`  | name ≤ 8                 | `+0x24` | `circuitName` | A key of the circuits; an unknown one stops the game ("Unable to find circuit", `0x004bef1c`)              |
| `0x2b`  | integer, kept as 16 bits | `+0x34` | `shortNumber` | 4 for `racec0r0`; the numbers run 4 to 16 and 28, 29                                                       |
| `0x2c`  | none                     | `+0x2c` | `isFlagged`   | Sets the flag to 1 (the second pass of a circuit, `c3` to `c5`)                                            |
| `0x2d`  | name ≤ 8                 | `+0x14` | `secondName`  | The theme of the track (`castle1`, `pirate2`, `space3`, …)                                                 |
| `0x2e`  | name ≤ 8                 | `+0x1c` | `thirdName`   | The opponent's driver code (`RK` for `racec0r0`)                                                           |

Any other keyword is error 0. The port checks the circuit against the circuits it is given and raises `UnknownCircuitError`, as the original stops.

## The file in `LEGO.JAM`

`MENUDATA\LEGORACE.RCB` (1,350 bytes) parses to its last byte: 27 entries. The first race, Royal Knights Raceway, is the entry `rkr`: race 1 of circuit `c1`, folder `racec0r0`, theme `castle1`, opponent `RK`. Circuits `c0`, `c1`, `c2` list four races each (`c0`: `racec0r1`, `racec1r0`, `racec0r3`, `racec0r2`); `c3` to `c5` repeat them reversed with the flag set; `c6` has `racec3r0` (`Final`, opponent `RR`); the entries `rr2` and `test` have no circuit.

The front end, with no local player, picks one of the four races of `c0`..`c3` with `0x004befec[random] & 0x80000003` (random-table.md).

Port: `parseRaceCatalog(bytes, circuits) → { entries, readByteCount }`.
