import { getDisplayedColourShift, getRacerVolumeParts } from '../../../racer/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { Racer } from '../../../racer/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { RacerPose, RacerShadow } from '../../types/race-presentation.types.ts'

// Racer +0xd04 bit 0x10: the warp has taken the car off the track.
const OFF_TRACK_FLAG = 0x10
// 0x004b0af4 and 0x004b0af0: the shadow's box starts 6 above the figure's centre and reaches 15 along its direction.
const SHADOW_HEIGHT_OFFSET = 6
const SHADOW_DEPTH = 15
// Vehicle +0x58: the direction a shadow is projected along (straight down).
const SHADOW_NORMAL = Object.freeze({ x: 0, y: 0, z: -1 })

// 0x0043fa50: the decal sits on the figure's centre, its picture's up is minus the display frame's second row, its size is
// the chassis's hull extents (vehicle +0x198 and +0x19c, which the hull points halve).
const getRacerShadow = (racer: Racer, centre: Vector3): RacerShadow => {
  const { rotation } = racer.carBody.rigidBody.displayFrame
  const hullPoint = racer.carBody.rigidBody.localHullPoints[1] ?? { x: 0, y: 0, z: 0 }
  return Object.freeze({
    placement: Object.freeze({
      position: Object.freeze({ x: centre.x, y: centre.y, z: centre.z + SHADOW_HEIGHT_OFFSET }),
      normal: SHADOW_NORMAL,
      upHint: Object.freeze({ x: -rotation[3], y: -rotation[4], z: -rotation[5] }),
      width: hullPoint.y * 2,
      height: hullPoint.x * 2,
      depth: SHADOW_DEPTH,
    }),
  })
}

// Where each racer's car is drawn: its display frame (racer +0x5c), which the physics step keeps up to date, the
// leaned car model frame and the driver, and the animations of the wheels and the driver.
export const getRacerPoses = (raceState: RaceState): readonly RacerPose[] => {
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  return Object.freeze(
    raceState.racerSet.racers.map((racer, racerIndex) => {
      const parts = getRacerVolumeParts(arithmetic, racer)
      const isOffTrack = (racer.flags & OFF_TRACK_FLAG) !== 0
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
        shadow: isOffTrack ? null : getRacerShadow(racer, parts.wheels.centre),
        isOffTrack,
      })
    })
  )
}
