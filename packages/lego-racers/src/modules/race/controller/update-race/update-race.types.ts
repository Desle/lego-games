import type {
  PlayerController,
  PlayerControllerInput,
  PlayerControllerState,
} from '../../../racer/index.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'

export type PlayerControllerRun = (
  input: PlayerControllerInput,
  playerIndex: number
) => PlayerControllerState

export type PlayerControllerProgress = {
  readonly controllers: readonly PlayerController[]
  readonly racerSet: RaceRacerSet
}
