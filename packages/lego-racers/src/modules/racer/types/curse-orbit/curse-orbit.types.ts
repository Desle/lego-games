import type { FloatArithmetic, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { RacerTables } from '../racer.types.ts'

// The frame (position and rotation) a curse figure starts from: the curse on the track at the moment a racer drives into it
// (0x00439900 copies it from the figure of the curse effect, or from the giver's racer figure on a hand-over).
export type CurseFigureFrame = {
  readonly position: Vector3
  readonly rotation: Matrix3
}

// The figure the cursed racer wears (racer +0x29c, vehicle +0x284: the model `curse`, bound by 0x00439900 and let go by
// 0x00439b00): where it is, how large (frame +0x58) and how long its clip 0 has played.
export type CurseFigure = CurseFigureFrame & {
  readonly scale: number
  readonly animationMilliseconds: number
}

// What 0x0043f530 keeps of a cursed vehicle between updates. `figure` is null while the racer carries no curse; the
// original's figure then holds a fresh frame (the origin, the identity, scale 1).
export type CurseOrbit = {
  // Vehicle +0x378: the orbit clock, counting down from 1000 and starting again, only while the racer is cursed.
  readonly clockMilliseconds: number
  // Vehicle +0x37c: counts down from 1000 while the racer is cursed (the figure turns toward its orbit with it), and is
  // 1000 again on every update without the curse.
  readonly blendMilliseconds: number
  readonly figure: CurseFigure | null
}

export type CurseOrbitInput = {
  readonly arithmetic: FloatArithmetic
  readonly tables: RacerTables
  // The car model frame's position (vehicle +0x3c, the display frame's) and the car body's speed (+0x604).
  readonly carPosition: Vector3
  readonly carSpeed: number
  readonly stepMilliseconds: number
}
