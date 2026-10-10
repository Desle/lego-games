# Feature: random-table

## Behaviour

The game's only source of randomness: the 1,024 `uint16` values at `0x004befec` in `LEGORacers.exe`, read through a global position (`0x004c6ee4`) that advances before every read. The table is loaded from the player's own executable; the position is explicit state. Details and every caller are in `.docs/reverse-engineering/random-table.md`.

## User flows

- **Load the table**: `loadRandomTable` takes the bytes of `LEGORacers.exe`, finds `0x004befec` through the PE section table and returns the validated table.
- **Draw**: `drawRandomValue`, `drawRandomRemainder`, `drawRandomLowByte` and `drawRandomScaledRange` take the table and a position and return the advanced position with the value in the form the calling code uses.
- **Synchronise**: a server sends the position (an integer 0..1023) at race start; `createRandomTablePosition` validates it.

## Invariants

- The table is never shipped: it comes from the player's executable.
- Every draw advances the position by exactly one, wrapping at 1,024, before reading.
- A remainder by zero is refused (`RandomDivisorError`) because the original crashes there.
- No clock, DOM or `Math.random`.

## Out of scope

The callers themselves (menus, hazards, power-ups, driver figures); the AI callers live in `racer-ai`.
