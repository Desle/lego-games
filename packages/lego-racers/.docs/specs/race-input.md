# Feature: race-input

## Behaviour

Maps the keyboard and a gamepad to the nine bindings of the player controller with the original default layout (`0x004b0624`, `0x0042e960`).

## User flows

- **Read the controls**: `getRacerControls(snapshot)` returns the `RacerControls` for the held keys and gamepad.

## Invariants

- Left/Right/Up/Down/Enter/Right Ctrl/M/Space/Right Alt are bindings 0..8.
- Gamepad buttons 0..6 are bindings 2..8; the first axis is the steering axis.

## Out of scope

Remapping, other devices, and the front end's choice of device per player; the gamepad axis index is a hypothesis.
