import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { ExplosionState as ExplosionStateValues } from './explosion.ts'

export type ExplosionState = EnumValues<typeof ExplosionStateValues>

// The parameter block 0x00459b80 passes to 0x00421250, per pool.
export type ExplosionParameters = {
  // +0x230: the growth takes this many milliseconds.
  readonly growthMilliseconds: number
  // +0x234: a ground burst's scar then lasts this long.
  readonly scarMilliseconds: number
  // +0x264: the frame scale at the end of the growth.
  readonly finalScale: number
  // +0x22c.
  readonly blastKind: number
}

// One explosion object (class 0x004210b0, 0x270 bytes).
export type Explosion = {
  readonly state: ExplosionState
  // The frame position (+0x08 frame).
  readonly position: Vector3
  // +0x21c: the racer who caused it, never hurt by it.
  readonly owner: number | null
  // +0x268: a ground burst, which leaves a scar.
  readonly isGroundHit: boolean
  // +0x238: milliseconds left of the current phase.
  readonly remainingMilliseconds: number
  // +0x248 and +0x24c: the growth progress (0.05 to 1) and its rate.
  readonly progress: number
  readonly progressRate: number
  // +0x250 and +0x254: the starting rate and the rate's change per second.
  readonly startRate: number
  readonly rateChange: number
  // The frame scale (0x00410f10), which the collision registry multiplies with the model's radius.
  readonly scale: number
  readonly parameters: ExplosionParameters
}

// Racer fields the blast reads.
export type BlastTarget = {
  // Racer +0xd04 & 0x1.
  readonly isShielded: boolean
  // Racer +0xaa8 & 0x80.
  readonly isStruckByLightning: boolean
  // Racer +0xd08 == 2.
  readonly isComputer: boolean
  // Racer +0x550..+0x558.
  readonly axis: Vector3
}

export type ExplosionPool = {
  readonly explosions: readonly Explosion[]
  // The active list (+0x193c or +0x1940), head first; the free list is the rest.
  readonly activeIndices: readonly number[]
  readonly freeIndices: readonly number[]
}
