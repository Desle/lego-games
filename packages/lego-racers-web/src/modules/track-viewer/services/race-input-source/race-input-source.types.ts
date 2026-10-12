import type { RaceInputSnapshot } from '@lego-games/lego-racers/race-input'

export type RaceInputSource = {
  readonly read: () => RaceInputSnapshot
  readonly dispose: () => void
}
