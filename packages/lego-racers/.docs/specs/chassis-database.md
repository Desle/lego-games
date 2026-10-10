# Feature: chassis-database

## Behaviour

Parses `CHASSIS.CMB` as `Chassis_Load` (`0x0041db10`): the wheel points, hull extents, base mass, three ratings and model variants of each chassis.

## User flows

- Parse chassis: `parseChassisDatabase(bytes)` returns the chassis and `readByteCount`.

## Invariants

- The three ratings start at 50, 80 and 50; an unknown keyword in a variant block is skipped without a value, an unknown record keyword is a syntax error.

## Out of scope

Creating the model instances (`0x0041e360`).
