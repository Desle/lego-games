# Feature: race-catalog

## Behaviour

Parses `LEGORACE.RCB` as `RaceCatalog_Load` (`0x004366f0`): each race's folder, circuit, theme and opponent.

## User flows

- Parse the catalog: `parseRaceCatalog(bytes, circuits)` returns the entries and `readByteCount`.

## Invariants

- A race naming a circuit that is not in the circuits stops with `UnknownCircuitError`; an unknown keyword is a syntax error.

## Out of scope

The circuit's table of races (`circuit +0x48`); it can be derived from `raceNumber`.
