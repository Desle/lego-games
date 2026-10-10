# Circuits (`LEGORACE.CRB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/circuit-database`. A circuit lists the drivers who race on it; the races of a circuit are in [race-catalog.md](race-catalog.md). Who ends up in which racer slot is in [racer-setup.md](racer-setup.md).

`Circuits_Load` (`0x0041f1d0`, from the front end `FUN_0042d1e0`, name `"LEGORace"` at `0x004bebc8`, folder `MENUDATA`) reads `legorace.crb` and fills a table of 100-byte records through `FUN_0041f030`:

```
0x27 [ count ] {
  (0x27 name { keyword value ... }) * count     // name: string of at most 8 characters, the key
}
```

| Keyword | Value                                      | Record                   | Port field     | Meaning                                                                                                                          |
| ------- | ------------------------------------------ | ------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `0x28`  | `[ n ] { name * n }` (each ≤ 8 characters) | `+0x14` count, `+0x18`.. | `racerCodes`   | Keys of the driver database. The record holds 8 names (`+0x18`..`+0x57`); more would overwrite `+0x58`, so the port refuses them |
| `0x29`  | integer, kept as 16 bits                   | `+0x60`                  | `firstNumber`  | The circuit's number (0 for `c0` to 6 for `c6`)                                                                                  |
| `0x2a`  | integer                                    | `+0x58`                  | `secondNumber` | Also 0 to 6                                                                                                                      |
| `0x2b`  | string (copied over 8 characters)          | `+0x0c`                  | `nextName`     | The next circuit (`c1` after `c0`; empty after `c6`)                                                                             |

Any other keyword is error 0. The record also stores the name key at `+0x04`, the JAM flag at `+0x5c`, and (written by `RaceCatalog_Load`) up to four race pointers at `+0x48`.

## The file in `LEGO.JAM`

`MENUDATA\LEGORACE.CRB` (399 bytes) parses to its last byte: seven circuits.

| Circuit | Racer codes (slots 0 to 5) | Next |
| ------- | -------------------------- | ---- |
| `c0`    | `KK CR GB RH AD PH`        | `c1` |
| `c1`    | `KK KK IL RK CC TC`        | `c2` |
| `c2`    | `BB BB WW BH SB AP`        | `c3` |
| `c3`    | `JT JT GB RH AD PH`        | `c4` |
| `c4`    | `BVB BVB IL RK CC TC`      | `c5` |
| `c5`    | `GM GM WW BH SB AP`        | `c6` |
| `c6`    | `RR RR BK AL GS NH`        | —    |

The front end (`FUN_0042d730`, racer-setup.md) copies code `i` into racer slot `i`; the first code of a circuit is replaced by the player's own car. Royal Knights Raceway (`RACEC0R0`) belongs to `c1`, so its computer racers are `KK`, `IL`, `RK`, `CC` and `TC`.

Port: `parseCircuitDatabase(bytes) → { circuits, readByteCount }`.
