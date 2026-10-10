import type { PowerUpContext, PowerUpStep } from '../../../power-ups/index.ts'
import type { RacerSetContext } from '../../../racer/index.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'

export type RaceWorldChange = (
  context: RacerSetContext,
  racerSet: RaceRacerSet,
  change: (step: PowerUpStep, powerUpContext: PowerUpContext) => PowerUpStep
) => RaceRacerSet
