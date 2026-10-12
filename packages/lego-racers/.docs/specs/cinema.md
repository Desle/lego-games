# Feature: cinema

## Behaviour

Parses a cinema database (`PST.CDB`) as `Cinema_Load` (`0x00406980`): the worlds it names and each cinema's objects, actions, dummies and lights, and says which actions are on the timeline at a time (30 frames per second, looping).

## User flows

- Parse cinemas: `parseCinemaDatabase(bytes)` returns the world names, the cinemas and `readByteCount`.
- Play a cinema: `getActiveCinemaActions(cinema, milliseconds)` lists the actions shown; `getCinemaFrame` and `getCinemaLoopMilliseconds` give the clock inside the loop.

## Invariants

- A cinema without its own length is as long as its longest object; keywords an entry does not know are skipped.

## Out of scope

Lights, dummy objects, `PST.CEB` events and `PST.MAB` material animations.
