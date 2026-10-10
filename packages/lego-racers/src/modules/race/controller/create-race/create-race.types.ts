import type { Racer } from '../../../racer/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import type { RaceRacerPowerUpSetup } from '../../types/race.types.ts'

export type RacerSetup = {
  readonly racer: Racer
  readonly setup: RaceRacerPowerUpSetup
  readonly position: RandomTablePosition
}
