# Power-up placements (`.PWB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/power-up`.

`PowerUps_Load` (`0x00458810`, power-ups at race `+0x6dc`, arguments name, JAM, mirror; `RET 0xc`) reads keywords until the end of the file: `0x27` → `0x00458a80`, `0x2f` → `0x00458e80`, any other token is skipped. `0x00433480` renames `POWERUP.PWF` to `POWERUP2.PWF` before the call in some modes (writes at `0x00433f6c`..`0x00433f94`).

Both lists are `[ count ]`, then for a non-zero count `{ block * count }` (the closing curly is checked with error 6 only then).

## `0x27` bricks (`0x00458a80`, `0x68`-byte objects)

Each block: `0x27` (else error 19), `{` (else 5), keywords until `}`:

| Keyword                           | Effect                                             |
| --------------------------------- | -------------------------------------------------- |
| `0x28`                            | 3 floats, position                                 |
| `0x2a` / `0x2c` / `0x2d` / `0x2b` | kind 1 / 2 / 3 / 4 (default 3)                     |
| `0x2e`                            | int; stored at brick `+0x48` when ≥ 0 (default -1) |
| `0x30`                            | name ≤ 8 then int, dropped (falls into `0x31`)     |
| `0x31`                            | int, dropped                                       |

Other keywords: error 0. After the block the position's y is negated on a mirrored track, then the power-up flags at `+0x58` may override the kind (`& 0x44` → 1, else `& 8` → 4, else `& 0x10` → 3); the port leaves that override to the caller. Models: `pbrickP/M/S/T`, `ptrailP/M/S/T`, `gen`, `genblen`.

## `0x2f` enhancement bricks (`0x00458e80`)

Blocks start with `0x2f`; keywords `0x28` position, `0x30`, `0x31` as above; others error 0. Mirror as above. Models: `enh`, `enhblen`.

Unknown: what kinds 1..4 are, and what the `0x2e` identifier selects.

Verified: all 26 `.PWB` files parse to their last byte.
