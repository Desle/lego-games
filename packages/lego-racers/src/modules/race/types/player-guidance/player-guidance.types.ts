import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { Racer } from '../../../racer/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'

export type PlayerGuidanceInput = {
  readonly arithmetic: FloatArithmetic
  readonly checkpoints: readonly Checkpoint[]
  readonly stepMilliseconds: number
}

export type WrongWayStep = Racer
