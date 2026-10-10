import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { DebrisState as DebrisStateValues } from './debris.ts'

export type DebrisState = EnumValues<typeof DebrisStateValues>

// One brick-debris piece (0x14 bytes of the pool at power-up system +0x18bc, constructor 0x004514b0).
export type DebrisPiece = {
  readonly state: DebrisState
  // +0x0c: the attachment slot (the model instance) the piece plays on.
  readonly slotIndex: number | null
  readonly elapsedMilliseconds: number
  // The length of the animation it plays (model data, see DebrisAnimations).
  readonly durationMilliseconds: number
}

export type DebrisPool = {
  readonly pieces: readonly DebrisPiece[]
  // +0x78: the next of the four "brick1".."brick4" models.
  readonly nextModel: number
  // +0x7c: pieces thrown so far; chooses the animation.
  readonly thrownCount: number
}

// The animation lengths of the four debris models: [model][animation], in milliseconds. Model data from the JAM
// (the animation count is at model +0x30); 0x004514b0 picks animation thrownCount % count.
export type DebrisAnimations = readonly (readonly number[])[]

// The power-ups step (its attachment slots) and the pool after a throw or an update.
export type DebrisChange = {
  readonly step: PowerUpStep
  readonly pool: DebrisPool
}
