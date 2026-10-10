# Feature: champion-database

## Behaviour

Parses `CHAMPS.CCB` as `Champions_Load` (`0x0041d370`): each champion's resource names, chassis, mass and centre of mass.

## User flows

- Parse champions: `parseChampionDatabase(bytes)` returns the champions and `readByteCount`.

## Invariants

- Omitted keywords leave 0 or an empty name; an unknown keyword is a syntax error; the centre of mass is not mirrored.

## Out of scope

Creating the model instances (`0x0041d7a0`).
