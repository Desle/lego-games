# Chassis database (`CHASSIS.CMB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/chassis-database`. A chassis holds the physical numbers of a car: where its wheels are, how big its hull is, its base mass and its three ratings. Cars of champions ([champion-database.md](champion-database.md)) and cars built from bricks both sit on one. How a race turns a record into a rigid body is in [racer-setup.md](racer-setup.md).

`Chassis_Load` (`0x0041db10`, called by `RacerSet_Setup`, the menus `FUN_0047ff50` and `FUN_00480110`) reads `chassis.cmb`:

```
0x27 [ count ] {
  (0x27 name { keyword value ... }) * count     // name: string of at most 8 characters, the key
}
```

The record is 0x104 bytes, zeroed first except `+0x100 = 0x32`, `+0x101 = 0x50`, `+0x102 = 0x32`. Any keyword not listed is error 0.

| Keyword        | Value                                | Record                            | Port field                       | Meaning                                                                                                                        |
| -------------- | ------------------------------------ | --------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0x28`, `0x29` | `{ variant keywords }`               | `+0x00`..`+0x4f`                  | `variants[0]`, `variants[1]`     | One model variant (below); the second exists when its model name `+0x28` is set (`Chassis_CreateInstances`, `0x0041e360`)      |
| `0x2a`         | three floats                         | `+0xb8`,`+0xbc`,`+0xc0`           | `builtCentreOfMassBase`          | Base of the local centre of mass of a car built from bricks                                                                    |
| `0x2b`         | three floats                         | `+0xc4`..`+0xcc`                  | `vehiclePoint`                   | Vehicle `+0x4c..+0x54` (`0x0043d7a0`); not read by the simulation                                                              |
| `0x2c`         | float                                | `+0xd0`                           | `baseMass`                       | A built car's mass = this + its weight                                                                                         |
| `0x2d`         | two floats                           | `+0xd4`,`+0xd8`                   | `unreadPair`                     | Not read by the race                                                                                                           |
| `0x2e`         | two floats                           | `+0xdc`,`+0xe0`                   | `hullExtents`                    | Vehicle `+0x198`, `+0x19c` (racer `+0x1b0`, `+0x1b4`): `0x004371c0` halves them (`0x004af58c` = 0.5) into the hull points      |
| `0x2f`         | float                                | `+0xec`                           | `racerValue`                     | Racer `+0xd54`, read only by the engine and nearest-racer sound passes (audio)                                                 |
| `0x30`         | `{ float, float, 4 × three floats }` | `+0xe4`,`+0xe8`; `+0x58`..`+0x87` | `vehicleValues`, `vehiclePoints` | Vehicle `+0x1a0`, `+0x1a4` and `+0x1a8..+0x1d7`; not read by the simulation                                                    |
| `0x31`         | `{ 4 × three floats }`               | `+0x88`..`+0xb7`                  | `wheelPoints`                    | The four wheel points: the second is the wheel anchor, the others give the track width and the wheelbase (racer-setup.md)      |
| `0x32`, `0x33` | integer                              | `+0xf0`, `+0xf4`                  | `unreadIntegers`                 | Not read by the race                                                                                                           |
| `0x39`         | name ≤ 8                             | `+0x50`                           | `sharedResourceName`             | Written into the car's texture database entry (`+0x38`, `+0x3c`) and material library entry (`+0x18`, `+0x1c`) by `0x0043b480` |
| `0x3a`         | integer, kept as a byte              | `+0x100`                          | `steeringRating`                 | `CarBody_SetSteeringRating` (`0x0042ad70`) argument (after the weight bonus)                                                   |
| `0x3c`         | integer, kept as a byte              | `+0x101`                          | `throttleRating`                 | `CarBody_SetThrottleRating` (`0x0042ada0`)                                                                                     |
| `0x3b`         | integer, kept as a byte              | `+0x102`                          | `topSpeedRating`                 | `CarBody_SetTopSpeedRating` (`0x0042add0`)                                                                                     |

A variant block (`0x0041e210`) is `{ keyword name ... }` closed by `}`; an unknown keyword is **skipped without error** (and without reading a value, so its value is read as the next keyword):

| Keyword | Record (variant 0 / 1) | Port field            | Resource                                                                                 |
| ------- | ---------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `0x34`  | `+0x00` / `+0x08`      | `materialLibraryName` | Gol root slot `+0x10`                                                                    |
| `0x35`  | `+0x10` / `+0x18`      | `textureDatabaseName` | Gol root slot `+0x0c`                                                                    |
| `0x36`  | `+0x20` / `+0x28`      | `modelName`           | Gol root slot `+0x14`                                                                    |
| `0x38`  | `+0x30` / `+0x38`      | `animationName`       | An object of 0x34 bytes (constructor `0x004011a0`) loaded with the name and the JAM flag |
| `0x37`  | `+0x40` / `+0x48`      | `skeletonName`        | Gol root slot `+0x18` (skeleton)                                                         |

(The roles of `0x37` and `0x38` come from the slot each is loaded through; the 0x34-byte object of `0x38` is a hypothesis.)

## The files in `LEGO.JAM`

`GAMEDATA\COMMON\CHASSIS.CMB` (6,706 bytes, 24 chassis: `dachas0 dbchas0 dcchas0 ddchas0 vvchas0 rrchas0 bkchas0 rkchas0 rhchas0 ccchas0 achas0 phchas0 gbchas0 bhchas0 sbchas0 tcchas0 nhchas0 apchas0 kkchas0 crchas0 bvbcha0 jtchas0 bbchas0 gm_chas0`) is the one a race reads. `MENUDATA\PIECEDB\CHASSIS.CMB` (3,038 bytes) holds 12 of them for the menus. Both parse to their last byte. In every chassis: base mass 2,500, hull extents 8 × 9, and the four wheel points `(1.5432, ∓1.9889, 0)`, `(−1.4383, ∓1.9889, 0)` (hence track width 3.9778 and wheelbase 2.9815); only the ratings, the vehicle values and the model names differ.

| Chassis                                                       | Steering | Throttle | Top speed |
| ------------------------------------------------------------- | -------- | -------- | --------- |
| `dachas0`                                                     | 30       | 80       | 40        |
| `dbchas0`                                                     | 30       | 70       | 50        |
| `dcchas0`                                                     | 40       | 60       | 60        |
| `ddchas0`                                                     | 30       | 70       | 70        |
| `vvchas0`                                                     | 60       | 100      | 70        |
| `rrchas0`                                                     | 70       | 100      | 70        |
| `kkchas0`                                                     | 60       | 80       | 50        |
| `bvbcha0`                                                     | 60       | 100      | 50        |
| `jtchas0`                                                     | 50       | 80       | 70        |
| `bbchas0`                                                     | 70       | 80       | 50        |
| `gm_chas0`                                                    | 60       | 100      | 60        |
| the other twelve (`bk rk rh cc a ph gb bh sb tc nh ap`, `cr`) | 50       | 80       | 50        |

Port: `parseChassisDatabase(bytes) → { chassis, readByteCount }`.
