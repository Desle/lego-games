# Feature: driver-database

## Behaviour

Parses `DRIVERS.DDB` as `Drivers_Load` (`0x004208f0`) does: each driver's resource names, champion, personality bytes, voice number and preferred power-up.

## User flows

- Parse drivers: `parseDriverDatabase(bytes)` returns the drivers in file order and `readByteCount`.

## Invariants

- Omitted keywords leave 0 or an empty name; integers are kept as the bytes or 16-bit values the exe stores; an unknown keyword is a syntax error.

## Out of scope

Creating the model instances (`0x00420ef0`) and showing a driver's name.
