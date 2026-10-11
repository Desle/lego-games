import type { RaceState } from '../../../race/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { RacerPose } from '../../types/race-presentation.types.ts'

// Where each racer's car is drawn: its display frame (racer +0x5c), which the physics step keeps up to date, the
// leaned car model frame and the driver, and the animations of the wheels and the driver.
export const getRacerPoses = (raceState: RaceState): readonly RacerPose[] =>
  Object.freeze(
    raceState.racerSet.racers.map((racer, racerIndex) =>
      Object.freeze({
        racerIndex,
        position: racer.carBody.rigidBody.displayFrame.position,
        rotation: racer.carBody.rigidBody.displayFrame.rotation,
        isPlayer: raceState.playerRacerIndices.includes(racerIndex),
        bodyRotation: racer.vehicle.bodyRotation,
        driverPosition: racer.vehicle.driverPosition,
        wheelAnimation: getFigureAnimationState(racer.figure),
        driverAnimation: getFigureAnimationState(racer.vehicle.driverFigure),
      })
    )
  )
