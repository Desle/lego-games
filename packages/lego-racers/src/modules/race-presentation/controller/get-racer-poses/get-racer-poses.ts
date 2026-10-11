import type { RaceState } from '../../../race/index.ts'
import type { RacerPose } from '../../types/race-presentation.types.ts'

// Where each racer's car is drawn: its display frame (racer +0x5c), which the physics step keeps up to date.
export const getRacerPoses = (raceState: RaceState): readonly RacerPose[] =>
  Object.freeze(
    raceState.racerSet.racers.map((racer, racerIndex) =>
      Object.freeze({
        racerIndex,
        position: racer.carBody.rigidBody.displayFrame.position,
        rotation: racer.carBody.rigidBody.displayFrame.rotation,
        isPlayer: raceState.playerRacerIndices.includes(racerIndex),
      })
    )
  )
