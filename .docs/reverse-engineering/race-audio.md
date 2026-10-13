# The race's sounds (port: `race-audio`)

What the race asks its sound player for, where the sounds come from, how a sound is mixed for the listener, and the loops. Addresses are in `LEGORacers.exe`. [audio.md](audio.md) has the file formats, [audio-trace.md](audio-trace.md) how the port is compared with the original.

## Banks and ids

`RaceSounds_GetBank` (`0x00443c30`) sends an id to one of four banks: below 1000 the general bank (`GENERAL.SBK`), 1000..1099 the voice bank, 1100..2999 the voice folder bank (index = id - 0x44c), 3000 and up the track's bank (`LEVC0R0.SBK`, index = id - 3000). `Race_LoadVoicesAndSounds` (`0x004328f0`, through `0x00443ac0..0x00443b40`) loads them (recorded with `bankLoad` events of the audio trace):

| Bank         | File (`GAMEDATA\VOICES\` for the voices)                                                                    | Ids         |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ----------- |
| general      | `COMMON\GENERAL.SBK` (80 sounds)                                                                            | below 1000  |
| voice        | `VOICE<nn>.SBK`, 12 sounds: `nn` is the voice number of the first human racer (`0x00432a50`, entry `+0x5d`) | 1000..1099  |
| voice folder | the race description's voice folder (`voiceC0` to `voiceC3`, 72 sounds: six drivers of twelve)              | 1100..2999  |
| track        | the race's `LEV*.SBK`                                                                                       | 3000 and up |

A racer's voice base (racer `+0xd40`) is `1000 + 100 * racer index` for a built car and `12 * voice number + 0x44c` for a champion. The viewer used to load the general and the track bank only, so **every voice line was silent**. The port reads the human racer's voice number as 0 (**hypothesis**: the original reads it from the settings entry; the trace's races had 0 everywhere).

## `RaceSounds_PlayAt` and the mix

`PlayAt(id, position, minimum, maximum, volume, pitch)` (`0x00443b80`, slot `+0x10` of the bank = `0x0041b300`) makes a sound object (`0x0041b370`) at the position with the squared limits in `+0x30` and `+0x34`, the volume factor (`0x004180e0`) and the pitch (`+0x08`), and plays it. `RaceSounds_Play` (`0x00443b50`) plays without a position. `RaceSounds_Get` (`0x00443bd0`) hands out an object the caller plays itself, `play(1)` (`0x0041ad80`) looping it.

The sound system mixes each object for the listener (the human racer: position, and the axis to its left = its forward row's x and y turned a quarter turn) in `0x00417de0`:

- `d2` = squared distance. `d2 <= min2`: volume = the object's volume. `d2 >= max2`: silent. Between: `volume * (1 - (d2 - min2) / (max2 - min2))`.
- pan = `-0.7 * f^2 / d2` when `f` (the distance to the listener's left) is positive, `+0.7 * f^2 / d2` otherwise.
- DirectSound gets `volume < 0.005 ? -10000 : -3000 + 3000 * volume` (truncated, hundredths of a decibel; `0x00419650`) and `trunc(pan * 2500)` (`0x00419680`).
- The Doppler shift (`343` units per second) is below 0.01 % at racing speeds and is not ported.

`getSoundMix` follows it and is checked against values the emulator recorded (volume 0 and pan -560, volume -14). The viewer turns the DirectSound units into gains (`10^(units/2000)`, the quieter side for the pan).

Call sites pass 30 and 300 (`0x004b0958`, `0x004b095c`) except the voices (100, 400), the warp's `0x41` (200, 600), the ghost's touch (200, 300), the nearest racer (30, 200) and track events (their own record: keywords `0x2f` volume, `0x30` pitch, `0x31` minimum, `0x32` maximum). A `SoundRequest` carries its `source` where the port knows the position: racer sounds, the voices, the ghost's touch and track events; the others play at full volume in the middle (**open**: the cannon's explosions, the bricks and the oil slick need the effect's position).

## Who has sound objects

`Race_LoadTrackContent` (`0x00433480`) calls the racer constructor `0x00437540` for the **human** racers only (the camera racer when nobody is human): the engine loops (`0x20`, `10`, `0x3d`, skid `3`), the turbo hums `0x2a..0x2c` and the warp hum `0x2d` exist for them alone. The computers' engines are heard through one object, sound `0x4f` (`0x0043ccb0`), that `RacerSet_Step` (`0x0043c1b0`) puts on the racer nearest to the camera's racer while it is within 200 units (`0x0043ae20`): the pitch follows that racer's speed like the engine's middle loop. The port had no sound for the computers' cars at all.

## Racer voices (`0x00439240`)

Only while racer `+0xd44` is 0: sound `+0xd40 + r % 6` (+ 6 for a taunt line), then `+0xd44 = r * 4 + 5000`. The stack argument is 1 when `0x0043a210` is told the racer **gained** a place (0 when it lost one), 0 from `Vehicle_Update` (`0x0043ed9c`, stopping), from the contact (`0x00438be7`), from the ghost (`0x0048cf43`) and the lava monster (`0x0048dd10`), and 1 from the power-up code (`getStepWithVoice`). The draws were ported long ago; the sound was dropped. The ghost and the lava monster end their touch with the voice (their racers draw twice more than before).

## Sound sites ported in the sweep

| Sound (id)                                              | Where                                                                                                                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shield end `0x3b`                                       | `Shield_Advance` `0x0045c2a0`, state 4                                                                                                                                                          |
| oil slick landing `0x2e` and loop `0x30`                | `OilSlick_Advance` `0x004573a0` (the loop is stopped when the slick ends)                                                                                                                       |
| grapple launch `0x15`                                   | `0x00454360` state 2                                                                                                                                                                            |
| grapple let go `0x14`, or `0x16` + `0x49`               | `Grapple_Retract` `0x00454690` by whether a racer is latched (`+0xd4`)                                                                                                                          |
| wand spark `0x45`, end `0x42`                           | `0x00454e50` (between its two draws), `Wand_Advance` `0x00455060` state 4                                                                                                                       |
| rocket launch `0x33` (three per use)                    | `Rocket_Start` `0x00456560`                                                                                                                                                                     |
| rocket on the ground `0x32`                             | `Rocket_Update` `0x004568f0` (a hit on a racer is `0x00456fa0`)                                                                                                                                 |
| barrel loop `0x11`, end `5`                             | `Barrel_Advance` `0x00453240` case 2, `Barrel_Update` `0x00452ff0`                                                                                                                              |
| magnet place `0x21` and loop `0x22`, last second `0x4a` | `0x004560b0`, `Magnet_Advance` `0x00455f50`                                                                                                                                                     |
| warp `0x27` + `0x41`, end `0x29`                        | `Warp_Advance` `0x0045dc90` (`0x27` and `0x29` only for the racer's own warp, `+0xe0` = 0)                                                                                                      |
| shield loop `0x4c`, `0x35`, `0x4d`, `0x4e`              | `0x0045bd30` by level; ends with the shield                                                                                                                                                     |
| turbo hum `0x2a..0x2c`, warp hum `0x2d`                 | `Racer_UpdateLoopedSounds` `0x00437be0`: racer flag `0x40` and level (`+0xd68`), flag `0x10`; human racers only                                                                                 |
| landing `0x3f`, `0x40`, `4`                             | `Vehicle_Update` `0x0043e070`: one wheel, two or three, four came down                                                                                                                          |
| surface loop (the material's `+0x34`)                   | `0x0042aad0` starts it for a wheel on a material with flag `0x80`; `0x0042af90` keeps one id; `0x0042aa70`, `CarBody_Update` and the reset stop it (below 0.009 speed, tumbling, no wheel down) |
| ghost touch `0xbc7`, ghost loop `0xbc4`                 | `0x0048ce90`, `0x0048cac0` (the loop was emitted and never played)                                                                                                                              |
| track events (2A)                                       | `0x004642c0` plays or loops the sound at the event's position                                                                                                                                   |

The player's surface loop also keeps a clock (`+0x738`) that ramps its volume to 1 over 280 ms and a pitch from the side speed (`0x004293f0`); the port starts and stops the loop and does not ramp it (**open**).

## Open

- **Projectile fly-by loops** (`PowerUps_Update` `0x0045a72d..0x0045a76d`, objects made in `0x00458940`): sounds `7` (cannon), `0x34` (rocket), `0x17` (grapple) and `0x13` (wand) loop on the flying effect nearest to the camera's racer within 500 units (`0x00457970`); `0x0045b7a0`.
- **Tire squeal** (sound `0x3a`, volume 0.8, `0x00447f30`, started when the car body is told to turn by `0x0041fee0` or `0x00438e60`): it loops while body flag `0x8` and `+0x3ec` are clear and either flag `0x400` is set or a dot product of the body's axes is below `0x004b0d38`. Another car body loop is `0x3c` (`0x00448160`).
- **Ghost**: the sound when a racer is near (`0xbc5`, every 4 s, `0x0048cbb0`) and the pitch bend of its loop; **lava monster**: its loop `0xbba` follows the clip time in `0x0048da10`, which is not ported (the smoke and the signal `0x2b` too); **`0x00490070`**'s loop `0xbbb`.
- The cannon, barrel, brick and oil-slick sounds have no position, and loops of effects (oil, magnet, barrel) are placed at their owner.
- The Doppler shift; the volume ramp of the surface loop.
