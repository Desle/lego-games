import { getDriverPartBytes } from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import { drawRandomRemainder } from '../../../random-table/index.ts'
import type { RandomTable } from '../../../random-table/index.ts'
import {
  advanceSkeletonAnimation,
  getIsSkeletonClipEnded,
  getShownClipIndex,
  playSkeletonClipOnce,
} from '../../../skeletal-animation/index.ts'
import {
  RACER_SHOWCASE_DRIVER_FORWARD,
  RACER_SHOWCASE_DRIVER_POSITION,
} from '../../types/racer-showcase/racer-showcase.ts'
import type { RacerShowcaseView } from '../../types/front-end.types.ts'
import type {
  IdleClipDraw,
  RacerShowcase,
  RacerShowcaseAnimation,
  RacerShowcaseStep,
} from '../../types/racer-showcase/racer-showcase.types.ts'

// The figure starts with clip 0 as its current one (0x0040d550 zeroes it).
const INITIAL_CLIP_INDEX = 0
// The original draws until the clip differs; the guard only matters for an animation with a single idle clip.
const MAXIMUM_DRAWS = 64

// 0x00486810 with the draw of 0x00486730: the idle clip is a random one of the seven (`random table[++cursor] % 7`),
// drawn again while it is the clip the figure shows. It plays once (0x0040dad0, then the loop flag is cleared).
const getNewClip = (
  showcase: RacerShowcaseAnimation,
  randomTable: RandomTable,
  randomPosition: number,
  shownClipIndex: number
): IdleClipDraw => {
  let position = randomPosition
  for (let attempt = 0; attempt < MAXIMUM_DRAWS; attempt += 1) {
    const draw = drawRandomRemainder(randomTable, position, showcase.idleClipIndices.length)
    position = draw.position
    const clipIndex = showcase.idleClipIndices[draw.value] ?? -1
    if (clipIndex !== shownClipIndex) return { clipIndex, randomPosition: position }
  }
  return { clipIndex: shownClipIndex, randomPosition: position }
}

const getPlayedShowcase = (
  racerIndex: number,
  car: SavedCar,
  turntableMilliseconds: number,
  showcase: RacerShowcaseAnimation,
  randomTable: RandomTable,
  randomPosition: number,
  shownClipIndex: number
): RacerShowcaseStep => {
  const next = getNewClip(showcase, randomTable, randomPosition, shownClipIndex)
  return {
    showcase: Object.freeze({
      racerIndex,
      car,
      driverAnimation: playSkeletonClipOnce(showcase.animation, next.clipIndex),
      turntableMilliseconds,
    }),
    randomPosition: next.randomPosition,
  }
}

// What the pick screen asks the viewer to draw: the racer's car and his driver in his pose on the platform.
export const getRacerShowcaseView = (showcase: RacerShowcase | null): RacerShowcaseView | null =>
  showcase === null
    ? null
    : {
        design: showcase.car.design,
        chassisName: showcase.car.record.chassisName,
        driver: {
          partBytes: getDriverPartBytes(showcase.car.record),
          position: RACER_SHOWCASE_DRIVER_POSITION,
          forward: RACER_SHOWCASE_DRIVER_FORWARD,
          animationName: 'RSANIM',
          animation: showcase.driverAnimation,
        },
        turntableMilliseconds: showcase.turntableMilliseconds,
      }

// The slot's first update (0x00486a00 with the slot's flag set): the driver starts a random idle clip and the turntable
// starts. The first frame of the screen has no elapsed time for the figure, which shows the first frame of its clip, but
// the turntable (the world's own animation) has already run for the frame that made the screen (measured: its angle in
// the first frame is one frame ahead of the clip's).
export const createRacerShowcase = (
  racerIndex: number,
  car: SavedCar,
  showcase: RacerShowcaseAnimation,
  randomTable: RandomTable,
  randomPosition: number,
  turntableMilliseconds: number
): RacerShowcaseStep =>
  getPlayedShowcase(
    racerIndex,
    car,
    turntableMilliseconds,
    showcase,
    randomTable,
    randomPosition,
    INITIAL_CLIP_INDEX
  )

// One frame of the screen: a clip that has ended (0x0040e360) is replaced by another random one, then the figure and
// the turntable advance by the elapsed time.
export const stepRacerShowcase = (
  current: RacerShowcase,
  showcase: RacerShowcaseAnimation,
  randomTable: RandomTable,
  randomPosition: number,
  elapsedMilliseconds: number
): RacerShowcaseStep => {
  const isEnded = getIsSkeletonClipEnded(showcase.animation, current.driverAnimation)
  const played = isEnded
    ? getPlayedShowcase(
        current.racerIndex,
        current.car,
        current.turntableMilliseconds,
        showcase,
        randomTable,
        randomPosition,
        getShownClipIndex(current.driverAnimation)
      )
    : { showcase: current, randomPosition }
  return {
    showcase: Object.freeze({
      ...played.showcase,
      driverAnimation: advanceSkeletonAnimation(
        played.showcase.driverAnimation,
        showcase.animation,
        elapsedMilliseconds
      ),
      turntableMilliseconds: played.showcase.turntableMilliseconds + elapsedMilliseconds,
    }),
    randomPosition: played.randomPosition,
  }
}
