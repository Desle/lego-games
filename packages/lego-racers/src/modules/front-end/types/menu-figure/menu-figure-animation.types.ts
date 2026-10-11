import type { SkeletonAnimationState } from '../../../skeletal-animation/index.ts'

// The main menu's figure behaviour (screen `+0x2438` figure, timers `+0x2444`, `+0x2448`, flag `+0x243c`).
export type MenuFigureAnimation = {
  readonly animation: SkeletonAnimationState
  // +0x2444: milliseconds until the screen gives up waiting (60,000 from its construction).
  readonly idleMilliseconds: number
  // +0x2448: milliseconds until the figure waits at the glass again (30,000).
  readonly waitMilliseconds: number
  // +0x243c: the tap on the glass of this wait has sounded.
  readonly isGlassTapSounded: boolean
}

export type MenuFigureStep = {
  readonly figure: MenuFigureAnimation
  readonly soundNames: readonly string[]
}
