# Input defaults: the player controller's bindings

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/race-input`. The semantics of the nine bindings are in [racer.md](racer.md) (`0x004309c0`).

## Binding codes

`Race_AcquireControllers` (`0x004343e0`) hands each local player nine codes from the game settings (`+0x34c..+0x36c`, stride `0x28`, kind byte at `+0x348`: 3 keyboard, 4 joystick). A keyboard code is `0x10000000 | DirectInput scan code` (the front end's `0x0042ee70` stores them; `0x004309c0` compares the event code). Joystick: axis codes `0x40000001`, `0x40000000`, buttons `0x30000000 | n`.

## Defaults

`Controls_SetDefaults` (`0x0042e960`) copies three keyboard layouts from the table at `0x004b0624` (nine codes each) into slots 2..4 and fills the two joystick slots: bindings 0 and 1 the axis codes, bindings 2..8 buttons 0..6. `Controls_GetDefaultBinding` (`0x0042ef00`) reads the table for slots 2 and up; for a first player without a joystick `0x0042eac0` answers slot 2, so the defaults are layout 1:

| Binding | Role            | Scan code | Key         |
| ------- | --------------- | --------- | ----------- |
| 0       | steer positive  | `0xcb`    | Left arrow  |
| 1       | steer negative  | `0xcd`    | Right arrow |
| 2       | accelerate      | `0xc8`    | Up arrow    |
| 3       | brake           | `0xd0`    | Down arrow  |
| 4       | use power-up    | `0x1c`    | Enter       |
| 5       | change camera   | `0x9d`    | Right Ctrl  |
| 6       | change HUD mode | `0x32`    | M           |
| 7       | power slide     | `0x39`    | Space       |
| 8       | look behind     | `0xb8`    | Right Alt   |

Layout 2 (second player): `A D W X`, left Alt, `Q E`, left Shift, `Z` (`0x1e 0x20 0x11 0x2d 0x38 0x10 0x12 0x2a 0x2c`); layout 3: numpad `4 6 8 2`, right Shift, `3 7`, numpad Enter, `9`.

## Gamepad

Buttons 0..6 are bindings 2..8. The steering axis is the device's axis (`0x00430120` negates it: left is positive steering). **Hypothesis:** the first axis of a standard-mapping browser gamepad stands for the joystick's axis 1.

## Frame clock (`0x00416ef0`)

The delta is whole `timeGetTime` milliseconds, capped at 100 (`+0x828`, set by `0x004162c0`); under 12 the loop sleeps `12 - delta` and re-measures. The port polls and returns no frame until 12 ms have passed (`frame-clock`).
