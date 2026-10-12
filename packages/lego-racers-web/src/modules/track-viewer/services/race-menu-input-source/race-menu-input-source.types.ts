import type { RaceMenuInput } from '@lego-games/lego-racers/race'

export type RaceMenuInputSource = {
  // The menu keys pressed since the last read (the race's key handler 0x00435c00 sees each key as it goes down).
  readonly read: () => RaceMenuInput
  readonly dispose: () => void
}
