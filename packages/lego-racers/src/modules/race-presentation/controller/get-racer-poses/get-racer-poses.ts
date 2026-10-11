import { getDisplayedColourShift, getRacerVolumeParts } from '../../../racer/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { RacerPose } from '../../types/race-presentation.types.ts'

// Where each racer's car is drawn: its display frame (racer +0x5c), which the physics step keeps up to date, the
// leaned car model frame and the driver, and the animations of the wheels and the driver.
export const getRacerPoses = (raceState: RaceState): readonly RacerPose[] => {
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  return Object.freeze(
    raceState.racerSet.racers.map((racer, racerIndex) => {
      const parts = getRacerVolumeParts(arithmetic, racer)
      return Object.freeze({
        racerIndex,
        position: racer.carBody.rigidBody.displayFrame.position,
        rotation: racer.carBody.rigidBody.displayFrame.rotation,
        isPlayer: raceState.playerRacerIndices.includes(racerIndex),
        bodyRotation: racer.vehicle.bodyRotation,
        driverPosition: racer.vehicle.driverPosition,
        wheelAnimation: getFigureAnimationState(racer.figure),
        driverAnimation: getFigureAnimationState(racer.vehicle.driverFigure),
        colourShift: getDisplayedColourShift(racer),
        partCentres: Object.freeze({
          wheels: parts.wheels.centre,
          body: parts.body?.centre ?? null,
          driver: parts.driver.centre,
        }),
      })
    })
  )
}
