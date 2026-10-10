# Feature: computer-racer-route

## Behaviour

Parses a computer racer's `.RRB` route exactly as `AiRoute_Load` (`LEGORacers.exe` `0x004a4e30`) does, and picks which route file each computer racer loads exactly as `Race_LoadAiRoutes` (`0x00433190`) does, with one draw from the random table.

## User flows

- **Count a racer's routes**: the race calls `countComputerRacerRouteVariants(racer, isJamArchive, getIsFilePresent)` and gets, for each letter `f`, `m` and `s`, how many of `r{racer}_{letter}_0`, `_1`, … exist (at most ten).
- **Choose a route**: the race calls `chooseComputerRacerRoute(counts, drawRandomValue)`; it draws one value only when a variant exists and gets the letter and variant, which `getComputerRacerRouteFileName` turns into the file name.
- **Fall back**: when no racer got a route, the race tries `getFallbackComputerRacerRouteFileNames` in order for slot 0.
- **Parse a route**: the race passes the file's bytes and its mirror flag to `parseComputerRacerRoute` and gets the two vectors, two quaternions, two integers, the samples and `readByteCount`.

## Invariants

- Keywords are read until the end of the file; tokens outside `0x27`..`0x2d` are skipped, as the original's jump table does.
- Absent keywords keep the reset values of `0x004a50c0`: zero vectors, identity quaternions, zero integers.
- The sample index must be below the sample count (unsigned compare), else the load fails with "Invalid value".
- Each sample stores two `int16` and eight bytes, truncated as the original's 16- and 8-bit stores; a mirrored route negates y components, the quaternions' second and fourth components, and the sample fields `0x004a5e10` negates or swaps.

## Out of scope

The random table itself and its cursor (the caller passes `drawRandomValue`), and how racers follow the route.
