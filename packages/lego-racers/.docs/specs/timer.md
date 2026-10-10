# Feature: timer

## Behaviour

Parses a race's `.TIB` timers exactly as `Timers_Load` (`LEGORacers.exe` `0x00464aa0`) does, and resolves a randomised second value with one random-table draw as `0x00464750` does when it sets a timer up.

## User flows

- **Parse timers**: the race passes the bytes of `TIMER.TIB` to `parseTimers` and gets each timer's values, marks and identifier, and `readByteCount`.
- **Resolve the second value**: the race calls `resolveTimerSecondValue(timer, drawRandomValue)`; a randomised value draws once (modulo the value below `0x400`, times the value divided by `0x3ff` from `0x400` on).

## Invariants

- The file is `0x27 [ count`; for a count of zero nothing more is read (the trailing `] { }` stays unread). Otherwise `] {` and count blocks follow, and the final curly is never read.
- Inside a block, `0x28` and `0x29` take either `0x2b` and an integer (marking the value) or a value whose integer is kept; `0x2a` reads the identifier (default -1) and `0x2d` the third value (default 0). Any other keyword is a syntax error.
- A randomised value of 0 throws `TimerDivideByZeroError`, where the original divides by zero.

## Out of scope

Running the timers and the events they fire.
