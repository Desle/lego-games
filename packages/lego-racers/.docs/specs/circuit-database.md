# Feature: circuit-database

## Behaviour

Parses `LEGORACE.CRB` as `Circuits_Load` (`0x0041f1d0`): the racer codes of each circuit.

## User flows

- Parse circuits: `parseCircuitDatabase(bytes)` returns the circuits and `readByteCount`.

## Invariants

- More than eight racer codes are refused (the original overwrites the record); an unknown keyword is a syntax error.

## Out of scope

Choosing the circuit of a race (race-catalog).
