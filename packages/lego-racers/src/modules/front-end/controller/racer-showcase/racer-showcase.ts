import { getDriverPartBytes } from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import { drawRandomRemainder } from '../../../random-table/index.ts'
import type { RandomTable } from '../../../random-table/index.ts'
import {
  advanceSkeletonAnimation,
  blendToSkeletonClip,
  getIsSkeletonClipEnded,
  getShownClipIndex,
  playSkeletonClipOnce,
} from '../../../skeletal-animation/index.ts'
import {
  RACER_SHOWCASE_DRIVER_FORWARD,
  RACER_SHOWCASE_DRIVER_POSITION,
  RACER_SHOWCASE_REACTION_BLEND_MILLISECONDS,
} from '../../types/racer-showcase/racer-showcase.ts'
import type { RacerShowcaseView } from '../../types/front-end.types.ts'
import type { ScreenNavigation } from '../../types/front-end-screen.types.ts'
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
      pendingNavigation: null,
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
  const isEnded =
    current.pendingNavigation === null &&
    getIsSkeletonClipEnded(showcase.animation, current.driverAnimation)
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

// 0x00486890 (the button handler 0x00484f40 calls it when a racer is picked): a random reaction clip (`random table[++cursor]
// % 3`: `jump`, `yes!` or `spin`) blends in over 200 ms and plays once; the screen leaves by `navigation` when it has ended.
// The key's frame already plays it for `elapsedMilliseconds` (the port gets a key a frame after the original; measured: the
// racer pick leaves in the frame the original does, circuit-start.golden.spec.ts).
export const startRacerShowcaseReaction = (
  current: RacerShowcase,
  showcase: RacerShowcaseAnimation,
  randomTable: RandomTable,
  randomPosition: number,
  navigation: ScreenNavigation,
  elapsedMilliseconds: number
): RacerShowcaseStep => {
  const draw = drawRandomRemainder(randomTable, randomPosition, showcase.reactionClipIndices.length)
  const clipIndex = showcase.reactionClipIndices[draw.value] ?? -1
  const blended = blendToSkeletonClip(showcase.animation, current.driverAnimation, {
    clipIndex,
    durationMilliseconds: RACER_SHOWCASE_REACTION_BLEND_MILLISECONDS,
    isFirstAdvancing: false,
    isSecondAdvancing: false,
    isTargetLooping: false,
  })
  return {
    showcase: Object.freeze({
      ...current,
      driverAnimation: advanceSkeletonAnimation(blended, showcase.animation, elapsedMilliseconds),
      pendingNavigation: navigation,
    }),
    randomPosition: draw.position,
  }
}

// 0x004869b0: the screen may leave once the figure's clip has ended (a blend in progress has not).
export const getIsRacerShowcaseReactionDone = (
  current: RacerShowcase,
  showcase: RacerShowcaseAnimation
): boolean =>
  !current.driverAnimation.isBlending &&
  getIsSkeletonClipEnded(showcase.animation, current.driverAnimation)
