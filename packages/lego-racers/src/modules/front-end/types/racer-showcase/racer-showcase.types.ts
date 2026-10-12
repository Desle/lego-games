import type { ScreenNavigation } from '../front-end-screen.types.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import type {
  SkeletalAnimation,
  SkeletonAnimationState,
} from '../../../skeletal-animation/index.ts'

// The animations of the racer showcase (`MENUDATA\RSANIM.ADB`, set name `rsanim` at 0x004c21d4) and which of its clips the
// screen picks from: the idle clips by the string ids of 0x004c21bc (MENUNAME.SRF names them), as clip indices.
export type RacerShowcaseAnimation = {
  readonly animation: SkeletalAnimation
  // `breath1 breath2 swayf watch hips tapfoot hey!` (string ids 0x74 0x75 0x77 0x78 0x79 0x7a 0x7b); -1 for a name the
  // animation does not have (0x00486730 returns -1).
  readonly idleClipIndices: readonly number[]
  // `jump yes! spin` (string ids 0x7c 0x7e 0x7f, 0x004c21cc): the clips a pressed button starts.
  readonly reactionClipIndices: readonly number[]
}

// What the pick racer screen keeps of the showcase (the racer slot's figure `+0x232c` and the rotating shadow's clock).
export type RacerShowcase = {
  // The racer of the save the showcase shows, with his car loaded onto the grid.
  readonly racerIndex: number
  readonly car: SavedCar
  // The driver's pose: one idle clip played once (0x00486810).
  readonly driverAnimation: SkeletonAnimationState
  // The clock of the turntable, from the first frame of the screen: `CRSDOW.ADB` clip `a0` (200 frames) turns the car and
  // the shadows.
  readonly turntableMilliseconds: number
  // The way the screen leaves once the reaction clip of a pressed button has ended (0x004869b0 holds it until then).
  readonly pendingNavigation: ScreenNavigation | null
}

// The showcase after a step: the shared random cursor moves with every idle clip drawn.
export type RacerShowcaseStep = {
  readonly showcase: RacerShowcase
  readonly randomPosition: number
}

// The idle clip the screen drew and where the shared random cursor stands after it.
export type IdleClipDraw = {
  readonly clipIndex: number
  readonly randomPosition: number
}
