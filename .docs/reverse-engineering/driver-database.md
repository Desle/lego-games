# Driver database (`DRIVERS.DDB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/driver-database` (the frame shared by the five database files is in `named-record`). The pages that use it are [racer-setup.md](racer-setup.md), [champion-database.md](champion-database.md) and [chassis-database.md](chassis-database.md).

`Drivers_Load` (`0x004208f0`, called by `RacerSet_Setup` `0x0043b190` and the menu `FUN_00480310`) reads `drivers.ddb` (binary twin of `drivers.ddf`):

```
0x27 [ count ] {
  (0x27 name { keyword value ... }) * count     // name: string of at most 8 characters, the key
}
```

Each block fills a zeroed 0x30-byte record; every keyword of the list below is optional, any other is error 0 ("Syntax error"). The block's name is registered in a name table (`0x00411870`) that stops the game on a duplicate; a lookup (`0x004119a0`) compares the first eight characters and answers 0 for a name it does not hold. The loader also keeps room for `count` 0xf4-byte model instances and three pointer tables (the resources below, created later by `0x00420ef0`).

| Keyword | Value                        | Record  | Port field                                      | Meaning                                                                                                                                                                    |
| ------- | ---------------------------- | ------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x33`  | integer, kept as 16 bits     | `+0x00` | `nameStringIdentifier`                          | `Driver_GetDisplayName` (`0x00421090`) returns `StringTable_GetString(id)`                                                                                                |
| `0x28`  | name ≤ 8                     | `+0x02` | `materialLibraryName`                           | Loaded with Gol root slot `+0x10` (material database) by `0x00420ef0`                                                                                                      |
| `0x29`  | name ≤ 8                     | `+0x0a` | `textureDatabaseName`                           | Gol root slot `+0x0c` (texture database)                                                                                                                                   |
| `0x2a`  | name ≤ 8                     | `+0x12` | `modelName`                                     | Gol root slot `+0x14` (model); the instance is built with the skeleton `pelvis` (created at the end of `Drivers_Load` with root slot `+0x18`)                              |
| `0x2b`  | name ≤ 8                     | `+0x1a` | `championName`                                  | The key of the driver's champion in the champion database                                                                                                                  |
| `0x3a`  | two integers, kept as bytes  | `+0x22`, `+0x23` | `preferredPowerUpCode`, `preferredPowerUpLevel` | `0x0043b480` maps the first (1 to 4, else 0) to racer `+0xcd0` and copies the second to `+0xcd4`: the power-up brick the computer driver holds out for, and the level it waits for (ai.md, power-ups.md) |
| `0x2c`..`0x31` | integer, kept as a byte | `+0x24`..`+0x29` | `personalityBytes`                              | The six personality bytes `0x00436df0` turns into racer `+0xd1c..+0xd22` (`getComputerPersonality`, ai.md)                                                                 |
| `0x34`  | integer, kept as a byte      | `+0x2a` | `voiceNumber`                                   | Racer `+0xd40` (the voice sound base) = 12 · this + `0x44c`                                                                                                                |
| `0x35`..`0x39` | integer, kept as a byte | `+0x2b`..`+0x2f` | `unreadBytes`                                   | Not read by the race (the menus show them; hypothesis: the driver's statistics)                                                                                            |

Resource names are all lower case in the data; the driver "RR" loads `rrpelvis` as material library, texture database and model.

## The files in `LEGO.JAM`

Two copies, byte for byte identical (2,896 bytes, 24 drivers, `RR VV AD IL WW GS BK RK RH AL CC PH GB BH SB TC NH AP KK CR BVB JT BB GM`): `GAMEDATA\COMMON\DRIVERS.DDB`, which a race reads (`0x0042c4e0` sets the directory `GAMEDATA\COMMON` before `RacerSet_Setup`), and `MENUDATA\PARTDB\DRIVERS.DDB` for the menus. Both parse to their last byte. Highlights: the first driver `RR` has personality 10 in every byte and prefers power-up 3 (turbo) at level 3; `GM` has 100 in every byte and prefers power-up 1 at level 3; `KK` has `10, 100, 80, 20, 60, 70`, power-up 2 (shield), voice number 6, and champion `kk`. Several drivers share a champion: `AD`, `IL`, `WW`, `GS` and `BK` all drive `bk`.

Port: `parseDriverDatabase(bytes) → { drivers, readByteCount }`; look a driver up with `findNamedRecord(drivers, name)` from `named-record`.
