import { getBrickKindFromCode } from '../../../power-ups/index.ts'
import type { RaceState } from '../../types/race.types.ts'
import type { RaceGrant } from './get-race-state-with-grants.types.ts'

// The racer holds the granted brick at the granted level, as in the original (racer +0xccc and +0xd58).
export const getRaceStateWithGrants = (
  raceState: RaceState,
  grants: readonly RaceGrant[]
): RaceState =>
  grants.reduce((current, grant) => {
    const racer = current.racerSet.racers[grant.racer]
    const powerUpRacer = current.powerUpStep.world.racers[grant.racer]
    if (racer === undefined || powerUpRacer === undefined) return current
    return Object.freeze({
      ...current,
      racerSet: Object.freeze({
        ...current.racerSet,
        racers: Object.freeze(
          current.racerSet.racers.map((candidate, index) =>
            index === grant.racer
              ? Object.freeze({ ...candidate, heldPowerUp: grant.kind })
              : candidate
          )
        ),
      }),
      powerUpStep: Object.freeze({
        ...current.powerUpStep,
        world: Object.freeze({
          ...current.powerUpStep.world,
          racers: Object.freeze(
            current.powerUpStep.world.racers.map((candidate, index) =>
              index === grant.racer
                ? Object.freeze({
                    ...candidate,
                    heldBrickKind: getBrickKindFromCode(grant.kind),
                    enhancementLevel: grant.level,
                  })
                : candidate
            )
          ),
        }),
      }),
    })
  }, raceState)
