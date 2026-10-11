import {
  advanceSkeletonAnimation,
  blendToSkeletonClip,
  getIsSkeletonClipEnded,
  getShownClipIndex,
  playSkeletonClipOnce,
} from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type {
  MenuFigureAnimation,
  MenuFigureStep,
} from '../../types/menu-figure/menu-figure-animation.types.ts'

// MENUDATA\LEGOMAN.ADB: `start` (329 frames), `begin` (103) and `wait` (395).
const START_CLIP_INDEX = 0
const IDLE_CLIP_INDEX = 1
const WAIT_CLIP_INDEX = 2
// 0x00480e10.
const IDLE_TIMEOUT_MILLISECONDS = 60000
const WAIT_INTERVAL_MILLISECONDS = 30000
// 0x00481450: every blend of the figure lasts 200 ms and freezes both clips until it ends.
const BLEND_MILLISECONDS = 200
// 0x004b3770 (208.0): from this frame of `wait` the figure taps the glass; the sound is id 0x1d of GENC0R0.SBK
// (`0x0046e970`: the 29th entry, `glasstap.pcm`).
const GLASS_TAP_FRAME = 208
const GLASS_TAP_SOUND_NAME = 'glasstap'

// 0x00481000 (the screen is entered): the figure plays `start` once.
export const restartMenuFigureAnimation = (
  figure: MenuFigureAnimation,
  animation: SkeletalAnimation
): MenuFigureAnimation =>
  Object.freeze({ ...figure, animation: playSkeletonClipOnce(animation, START_CLIP_INDEX) })

// 0x00480e10 (the constructor's timers) and 0x00481000.
export const createMenuFigureAnimation = (animation: SkeletalAnimation): MenuFigureAnimation =>
  Object.freeze({
    animation: playSkeletonClipOnce(animation, START_CLIP_INDEX),
    idleMilliseconds: IDLE_TIMEOUT_MILLISECONDS,
    waitMilliseconds: WAIT_INTERVAL_MILLISECONDS,
    isGlassTapSounded: false,
  })

const getShownTime = (figure: MenuFigureAnimation): number =>
  figure.animation.isBlending
    ? figure.animation.secondClip.timeInFrames
    : figure.animation.clip.timeInFrames

// 0x00481450 (the screen's update, vtable +0x78) followed by the figure's own update 0x0040dd60: the timers run down; the
// tap on the glass sounds once in `wait`; when the wait timer is out the figure blends to `wait` (once) and the timer
// restarts, else a clip that has ended blends to `begin`, which loops. When the idle timer runs out the original ends the
// front end and starts a demonstration race; the port keeps the timer at zero (not ported).
export const stepMenuFigureAnimation = (
  figure: MenuFigureAnimation,
  animation: SkeletalAnimation,
  elapsedMilliseconds: number
): MenuFigureStep => {
  const idleMilliseconds = Math.max(0, figure.idleMilliseconds - elapsedMilliseconds)
  let waitMilliseconds = Math.max(0, figure.waitMilliseconds - elapsedMilliseconds)
  let isGlassTapSounded = figure.isGlassTapSounded
  const soundNames: string[] = []
  if (getShownClipIndex(figure.animation) === WAIT_CLIP_INDEX) {
    if (getShownTime(figure) >= GLASS_TAP_FRAME) {
      if (!isGlassTapSounded) soundNames.push(GLASS_TAP_SOUND_NAME)
      isGlassTapSounded = true
    } else {
      isGlassTapSounded = false
    }
  }
  let state = figure.animation
  if (waitMilliseconds === 0) {
    state = blendToSkeletonClip(animation, state, {
      clipIndex: WAIT_CLIP_INDEX,
      durationMilliseconds: BLEND_MILLISECONDS,
      isFirstAdvancing: false,
      isSecondAdvancing: false,
      isTargetLooping: false,
    })
    waitMilliseconds = WAIT_INTERVAL_MILLISECONDS
  } else if (getIsSkeletonClipEnded(animation, state)) {
    state = blendToSkeletonClip(animation, state, {
      clipIndex: IDLE_CLIP_INDEX,
      durationMilliseconds: BLEND_MILLISECONDS,
      isFirstAdvancing: false,
      isSecondAdvancing: false,
      isTargetLooping: true,
    })
  }
  return {
    figure: Object.freeze({
      animation: advanceSkeletonAnimation(state, animation, elapsedMilliseconds),
      idleMilliseconds,
      waitMilliseconds,
      isGlassTapSounded,
    }),
    soundNames,
  }
}
