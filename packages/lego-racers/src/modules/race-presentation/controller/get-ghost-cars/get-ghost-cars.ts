import { stepGhostPlayback } from '../../../ghost/index.ts'
import type { GhostPlaybackPose, GhostRunSelection } from '../../../ghost/index.ts'
import type { RaceState } from '../../../race/index.ts'
import {
  createFloatArithmetic,
  getFrameTransformedPoint,
  getMatrixFromQuaternion,
  RACE_FPU_PRECISION,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { GhostCar, GhostCarsStep } from '../../types/race-presentation.types.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { SkeletonAnimationState } from '../../../skeletal-animation/index.ts'

// Ghost_Initialize 0x00422420 writes the champion car's seat point (`this + 0x3a0`) from the constants 0xc0086d76, 0x3c37fe09 and
// 0x3fcdd2f2; the session's best run takes the seat point of the player's racer (0x00422eb0 copies racer +0x64..+0x6c).
const CHAMPION_SEAT_POINT: Vector3 = Object.freeze({
  x: Math.fround(-2.131680965423584),
  y: Math.fround(0.011230000294744968),
  z: Math.fround(1.6080000400543213),
})

const NO_CARS: readonly GhostCar[] = Object.freeze([])

// FUN_00422960, run by the draw's update 0x00435a00 every rendered frame while a race has a ghost: the best run's car (when it
// is shown) first, then the champion's. The playback marks a run finished once the clock passes its last pair, which the
// returned race keeps.
export const getGhostCars = (raceState: RaceState): GhostCarsStep => {
  const { ghost } = raceState
  if (ghost === null) return Object.freeze({ raceState, cars: NO_CARS })
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  const playback = stepGhostPlayback(arithmetic, ghost)
  const playerRacer = raceState.racerSet.racers[raceState.playerRacerIndices[0] ?? 0]
  const { bestCar, championCar } = playback.session
  const animations: Readonly<
    Record<GhostRunSelection, readonly [SkeletonAnimationState | null, SkeletonAnimationState | null]>
  > = {
    best:
      bestCar === null
        ? [null, null]
        : [getFigureAnimationState(bestCar.wheels), getFigureAnimationState(bestCar.driver)],
    champion: [championCar?.wheels.clip ?? null, championCar?.driver.clip ?? null],
  }
  const getCar = (
    kind: GhostRunSelection,
    pose: GhostPlaybackPose | null,
    seatPoint: Vector3
  ): readonly GhostCar[] => {
    if (pose === null) return NO_CARS
    const rotation = getMatrixFromQuaternion(arithmetic, pose.orientation)
    return Object.freeze([
      Object.freeze({
        kind,
        position: pose.position,
        rotation,
        driverPosition: getFrameTransformedPoint(
          arithmetic,
          { rotation, position: pose.position },
          seatPoint
        ),
        speed: pose.speed,
        wheelAnimation: animations[kind][0],
        driverAnimation: animations[kind][1],
      }),
    ])
  }
  return Object.freeze({
    raceState:
      playback.session === ghost
        ? raceState
        : Object.freeze({ ...raceState, ghost: playback.session }),
    cars: Object.freeze([
      ...getCar('best', playback.best, playerRacer?.vehicle.seatPoint ?? ZERO_VECTOR3),
      ...getCar('champion', playback.champion, CHAMPION_SEAT_POINT),
    ]),
  })
}
