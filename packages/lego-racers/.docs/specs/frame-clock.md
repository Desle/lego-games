# Feature: frame-clock

## Behaviour

Turns the browser's time into the original's frame delta: whole milliseconds, at most 100, never under 12 (`0x00416ef0`).

## User flows

- **Poll the clock**: `advanceFrameClock(clock, now)` returns the new clock and the frame milliseconds, or null when fewer than 12 ms have passed.

## Invariants

- The clock is pure; the caller passes the time.
- A frame never exceeds 100 ms.
- A poll that returns no frame leaves the clock unchanged.

## Out of scope

Reading the real clock, sleeping, and the 1.75 time scale (the race applies it).
