# Triggers (`.TRB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/trigger`.

`Triggers_Load` (`0x00465210`, arguments name, JAM) opens the file and reads `0x27 [ count ] {`; for count 0 it closes the reader and returns null. The callers then read count blocks and close the reader with `0x00465330` **without reading the final `}`**.

- `MainTriggers_Load` (`0x00463dc0`, race `+0x2080`, `RET 0x20`, mirror is argument 8): `0x58`-byte triggers (`0x00463ae0`, filled by `0x00463b60`).
- `EnvironmentTriggers_Load` (`0x00464ff0`, race `+0x2128`, `RET 0x14`, mirror is argument 5): `0x3c`-byte triggers (`0x00464e40`, filled by `0x00464e80`).

Each block: `0x27`, `{`, keywords until `}`:

| Keyword | Read by      | Values   | Effect                                                                                  |
| ------- | ------------ | -------- | --------------------------------------------------------------------------------------- |
| `0x29`  | `0x00465350` | 3 floats | position (local `+0x08`); y negated when mirrored                                       |
| `0x2a`  | `0x00465350` | float    | radius: `0x00410f10` stores it and centre x minus and plus it                           |
| `0x2b`  | `0x00465350` | int      | trigger `+0x34`                                                                         |
| `0x2f`  | `0x00465350` | —        | trigger `+0x38` bit 4; `0x004653f0` then registers with 9 instead of 1                  |
| `0x2c`  | main only    | —        | bit `0x1000`; `0x004653f0` registers with 2 instead of 4                                |
| `0x2d`  | main only    | name ≤ 8 | looked up among the collision world's objects (`+0xd8`); index at `+0x50`, bit `0x2000` |
| `0x2e`  | main only    | int      | `+0x54`, bit `0x4000`                                                                   |

Anything else is error 0 (in an environment file, `0x2c`..`0x2e` too).

Unknown: the meaning of the integers (`firstInteger`, `secondInteger`) and of the two flags.

Verified: all 28 `.TRB` files parse to one byte before their end; that byte is the `}` the original never reads.
