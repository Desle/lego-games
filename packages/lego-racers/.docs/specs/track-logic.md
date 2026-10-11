# Feature: track-logic

## Behaviour

Runs a track's events, triggers and timers exactly as the original does in `Race_Update` (`LEGORacers.exe` `0x00435220`): the signal bus (`0x00461ef0`, `0x00462580`, `0x00462140`), the twelve event classes, the triggers' per-frame release (`0x00465450`) and the timers with the registry's time list (`0x0042fc10`). It draws from the shared random table where the original does.

## User flows

- **Create**: the race calls `createTrackLogic` with the parsed EVB, TIB and TRB files; the 2A events and marked timers take their load-time draws in the original order.
- **Frame update**: `updateTrackLogicFrame` runs triggers, events, then timers; `tickTrackTimeEntries` runs the registry's time list with a sub-step's milliseconds (pass 4).
- **Signals and contacts**: `runTrackLogic` gives a `TrackSession` to start, stop, force-end and fire signals and deliver trigger contacts, and returns the new state and the effects asked for.

## Invariants

- No DOM, clock or `Math.random`: the random table position is explicit state.
- The new entries of the time list are visited first and wait for the next tick.
- A countdown event ends only when its time is 0 and its hold signal is off.
- Effects (sounds, animations, racer forces) are reported, never applied.

## Out of scope

Hazards, emitters, the world's animations and the registry's overlap detection.
