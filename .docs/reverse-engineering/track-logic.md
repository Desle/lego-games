# Track logic: events, triggers, timers and the signal bus

Source: `LEGORacers.exe` (English, 1999-07-22), decompiled and, for the vtables, read as bytes. Port: `packages/lego-racers/src/modules/event` (EVB parser) and `.../track-logic` (runtime). Anything not proven is marked **hypothesis**. Names are in `reverse-engineering/names/LEGORacers.exe.txt`.

## The signal bus

Events, hazards and timers talk over numbered signals. Three functions walk the event arrays in a fixed order:

| Address                     | Name                                                  | What it does                                                                                                                   |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0x00461ef0`                | `Events_StartSignal`                                  | `Begin` every event with the identifier (`0x0045ee50`); 4B: hold flag when `keyword 0x4c == id`; links; 59: hold flag; hazards |
| `0x00462580`                | `Events_StartStopSignal`                              | for `id1` begin, for `id2` end (`0x0045ee70`), hold flags set/cleared; links on `id1`; hazards                                 |
| `0x00462140`                | `Events_StopSignal`                                   | End the events with the identifier; clears hold flags; hazards                                                                 |
| `0x00462350`                | `Events_ForceEnd`                                     | State 5 on every event with the identifier (all twelve arrays); hazards state 3                                                |
| `0x004628c0`                | `Events_FireTrigger`                                  | classes 4D, 51, 55, 59: `0x0045eec0`; hazards if a racer                                                                       |
| `0x00462ae0` / `0x004629d0` | `Events_FireReleaseTrigger` / `Events_ReleaseTrigger` | surface contacts: fire `id1`, release `id2` / release                                                                          |

Array order of the three signal walkers: 2A (`+0x5c`), 28 (`+0x60`), 29 (`+0x64`), 3D (`+0x68`), 42 (`+0x70`), 4B (`+0x74`), 52 (`+0x78`), 53 (`+0x84`), the `0x39` links (`+0x6c`), 59 (`+0x8c`), hazards. `Events_Update` (`0x00461cc0`) walks 2A, 28, 29, 3D, 42, 4B, 52, 4D, 51, 53, 55, 59 and calls vtable `+0x14`.

### The base state machine (`0x0045ed40`)

Event `+0x14` identifier, `+0x18` state (1 inactive, 2 first phase, 3 running, 4 last phase, 5 end requested), `+0x1c` flags (2 held: never ended by the bus; 4 pulse: begin then end at once; bit meaning otherwise per class), `+0x08/+0x0c/+0x10` the signals announced on entering states 2/3/4.

- `Begin` (`0x0045ee50`, vtable `+4`): when flag 4 is clear and the state is 1 or 4.
- `End` (`0x0045ee70`, vtable `+0xc`): flag 4 clear or state not 1/4: end when state is not 1 and flag 2 is clear; otherwise begin, and end unless flag 2.
- `Update` (`0x0045edc0`): state 5 calls End.
- `Announce` (`0x0045edd0`, from state, to phase 0..2 or 3 = none): the from-state's signal (states 2, 3, 4) is stopped and the to-phase's started, in one `StartStopSignal`, or one `StartSignal` / `StopSignal`.

Handlers run, announce (a nested walk of the arrays), and only then store the new state; the port stores the state when the handler returns, which differs only if a signal re-enters the same event (**hypothesis**: none in the data).

## The twelve event classes

Classes, vtable (slot 1 begin, 3 end, 5 update), initial state and what the port models. "Effect" means the port reports a `TrackEffect` and the caller (rendering, sound, world animation) does the rest.

| Class | Vtable       | Begin / End / Update            | Initial state | Behaviour                                                                                                                               |
| ----- | ------------ | ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2A    | `0x004b1c84` | `4642c0` / `4643b0` / `4643e0`  | 1             | Random ambient sound. **Draws**: one at load (`0x004641b0`, timer = v % 1000 + 500); two per expiry while running with chance < 255     |
| 28    | `0x004b1c00` | `463570` / `4635c0` / `4633f0`  | 1             | Drives a scene object through four animations; reads the object's animation index and flags from the world                              |
| 29    | `0x004b1be4` | `463230` / `463280` / `463200`  | 1             | Material animation; ends when the world reports it finished                                                                             |
| 3D    | `0x004b1b0c` | `45eaf0` / `45eb90` / `45ebe0`  | 1             | Particle emitter that follows an object; update retries the emitter until the pool gives one                                            |
| 42    | `0x004b1aac` | `45e2a0` / `45e320` / base      | 1             | One-shot: begin sets state 5, the next update ends it                                                                                   |
| 4B    | `0x004b1af0` | `45e880` / `45e8a0` / `45e8d0`  | 4             | Countdown of `keyword 0x49` ms; ends at 0 unless the hold signal (`keyword 0x4c`) is on                                                 |
| 52    | `0x004b1c3c` | `463990` / `4639b0` / `4639d0`  | 1             | Follows an object (not ported)                                                                                                          |
| 53    | `0x004b1c20` | `4637c0` / `463800` / base      | 1             | Switches three values of an object (effect)                                                                                             |
| 4D    | `0x004b1de0` | Fire `465600`, release `465690` | 4             | Sets the racer's lighting (effect)                                                                                                      |
| 51    | `0x004b1ca4` | Fire `464680`, release `4646e0` | 4             | Puts the racer in zone 0, 1 or 2 (`0x00439b70`, `0x00439ba0`, `0x00439c40`): `track.racer_zone_entered`                                 |
| 55    | `0x004b1ad4` | Fire `45e6c0`, release `45e6f0` | 4             | Sets and clears the racer's guidance target (`0x00439e60`, `0x00439e90`; this is what sets racer flag `0x8000`)                         |
| 59    | `0x004b1bc8` | Fire `462fe0`, release `463040` | 1             | While the hold signal (`keyword 0x4c`) is on, a force on the racer's car body: slot `0x40` or `0x48` by `keyword 0x5a` (ends with `+4`) |

Initial flags: 2A, 28, 29: `0x2d` -> 1, `0x3a` -> 2, braced (`0x3c`) -> 4, `0x3f` -> 8 (the event takes the signal's position); 3D, 53: `0x3a` -> 2, braced -> 4; 4D: braced -> 4 and 2, `0x3a` -> 2.

2A chance: `_ftol(chance * 255.0f)` (`0x004b09c0`) as a byte; 255 (the default 1.0) plays the sound on every begin and draws nothing.

## Triggers

A trigger (`0x58` bytes main, `0x3c` environment) is a registry entry (sphere); the registry calls `Fire` for each overlapping racer.

- Main `Fire` (`0x00463c70`): a racer whose lap differs from `secondInteger` (flag `0x4000`) is ignored; `objectName` (flag `0x2000`) touches a tagged position (`0x0045e520`, effect); then `0x00464f40` (first touch announces `firstInteger` with `StartSignal` and sets flag 2; flag 1 = touched) and, for a racer new to the trigger (`+0x3c` mask against last frame's `+0x40`), `FireTrigger(id, racer)`.
- `Triggers_Update` (list vtable `+0x10`, `0x00465450`): every trigger's vtable `+0xc`: environment `0x00464ef0` (a trigger nobody touched stops its signal with `StopSignal`), main `0x00463c00` (the same, then `ReleaseTrigger(id, racer)` for racers inside last frame and not now, then the masks shift). Environment triggers first, then main.
- Not ported: the registry contact type 2 (`0x0045b9a0`; no shipped trigger file sets the flag `0x2c` that registers for it). The projectiles' hit on a surface with a signal (`0x0041f730`) is ported: [surface-signals.md](surface-signals.md), and the registry's overlap detection itself (`0x0042fd10`): the caller delivers `TrackTriggerContact`s.

## Timers and the registry's time list

The registry (race `+0x4ac`, racer set `+0xf0`, vtable `0x004b0710` and its racer-aware subclass) holds entries of several types. Type 1 (`0x0042fb90`) is the **time list**: new entries go at the **head**, start with 0 ms elapsed, and `0x0042fc10` adds the time to each, fires those whose delay is reached (head first; callbacks that register entries put them at the head, so they wait for the next tick) and drops fired one-shot entries. The registry is ticked by pass 4 of `RacerSet_Step` (`0x0043d180` → `0x0043aa10` → `0x0042fce0`) with **each sub-step's milliseconds**, not the frame's.

- Setup (`0x00464750`): a marked second value takes one draw; with no third value the timer registers an entry with it.
- `Timers_Update` (`0x00464dd0` / `0x00464830`): a third value counts down; at 0 the timer starts with its first value (a marked first value draws).
- Callback (`0x004648d0`): first phase: `StartSignal(id)`, wait the first value reduced by the overshoot (`elapsed - second`, unsigned) and drawn again when marked; second phase: `StopSignal(id)`, wait the second value likewise (marked by flag 4). Scaled draws: `v % range` below `0x400`, else `(range / 0x3ff) * v`.

## Random draws now modelled

| Site                             | Draws                                                     |
| -------------------------------- | --------------------------------------------------------- |
| `0x004641b0` event 2A load       | 1 per 2A event, in file order, before the timers load     |
| `0x00464750` timer setup         | 1 per marked second value with no third value (as before) |
| `0x00464830` third value expired | 1 when the first value is marked                          |
| `0x004648d0` timer callback      | 1 when the next wait is marked                            |
| `0x004643e0` event 2A update     | 2 per expiry while running and chance < 255               |

## Not ported (gaps)

- **Hazards**: the 20 classes (parser only; vtable map in [hazard.md](hazard.md)). Their draw sites are `0x0048b3c0`, `0x0048c680`, `0x0048cbb0`, `0x0048d730`, `0x0048e7f0`, `0x0048eb70` (camera update, vtable `+0x18`, run after the racers), `0x0048f5b0`; `Hazards_Update` sits between `Events_Update` and `Timers_Update`. The bus already has the hook points (`0x0048aad0`, `0x0048abb0`, `0x0048ab20`, `0x0048ab70`, `0x0048ac30`, `0x0048ad10`, `0x0048aca0`).
- **Emitters**: `Emitters_Update` and the firing draws `0x004897e0` (emitter pool shared with vehicles and power-ups).
- Sky updates draw nothing (checked against the draw-site list).
- World coupling: scene object animation state (classes 28, 52, 3D), material animations (29), sound slots (2A) and the emitter pool come from the `TrackWorld` dependency; the default never animates. The car-body force slots of class 59, racer lighting (4D) and racer guidance (55) are reported as effects, not applied to racers; surface contacts (`0x0042aa30`, `0x0042aa70`) and trigger overlaps are inputs the caller must deliver (`TrackSession`).
- `0x00493a20`, `0x00492870`, `0x00494f60` (three object lists ticked in `Race_Update`) draw nothing and are not ported.
- 4D keyword `0x4e`/`0x4f` integers are uninitialised in the original when absent; the port uses 0.
