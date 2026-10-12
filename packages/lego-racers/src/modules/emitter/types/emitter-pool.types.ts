import type { MaterialAnimation } from '../../material-animation/index.ts'
import type { RandomTable, RandomTablePosition } from '../../random-table/index.ts'
import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'
import type { EmitterList } from './emitter.types.ts'

// One particle (0x38 bytes, FUN_004145e0; offsets in the comments).
export type Particle = {
  // +0x04: relative to the system's frame, which sits where the system's first particle was born.
  readonly position: Vector3
  // +0x1c
  readonly velocity: Vector3
  // +0x28 (uint32) and +0x2c: the particle dies once the age is greater than the lifetime.
  readonly ageMilliseconds: number
  readonly lifetimeMilliseconds: number
  // +0x30: the row of the emitter's material animation entry that the age selects (0x00410560), or null while
  // the emitter has none (the system's default material applies).
  readonly tableIndex: number | null
  // +0x30 is not null: the particle has a material to draw with (a newborn one gets it at the next update).
  readonly isDrawable: boolean
}

// The particle system inside an emitter instance (instance +0x08, flags +0xb8 of the system; 0x00412430).
export type EmitterSystem = {
  // The live particles, the head of the original's list first.
  readonly particles: readonly Particle[]
  // +0xa8: 16 particles.
  readonly capacity: number
  // Flag 0x02.
  readonly isActive: boolean
  // Flag 0x10: released while particles were alive; the system resets once the last one died.
  readonly isDying: boolean
  // Flag 0x04: set when the definition's third or fourth float is not zero (0x00412660).
  readonly isMoving: boolean
  // +0xbc: the acceleration every particle gets (the definition's vector).
  readonly acceleration: Vector3
  // +0xd0 (entry) and +0xcc/+0xc8 (table): the material animation entry that colours the particles, or null.
  readonly entryIndex: number | null
  // +0xd8, +0xdc, +0xe0, +0xe4 and +0x94 (squared): the definition's floats, kept for the renderer.
  readonly firstFloat: number
  readonly secondFloat: number
  readonly thirdFloat: number
  readonly fourthFloat: number
  readonly squaredRadius: number
  // +0xe8: how many particles were born since the system was last started.
  readonly bornCount: number
  // +0xd4: the material of the particles of a system without a material animation (the definition's linked name), or null.
  readonly defaultMaterialName: string | null
  // The position of the frame at system +0x10; set by the first particle born (0x00412760).
  readonly framePosition: Vector3
}

// One of the pool's emitters (0x18c bytes, FUN_004893f0).
export type EmitterInstance = {
  // +0x00: the definition index, or null once released (the particles then run out).
  readonly definitionIndex: number | null
  // +0x04: the handle slot that refers to this instance.
  readonly handleIndex: number | null
  readonly system: EmitterSystem
  // +0x148 (0x00489690): added to every particle's velocity.
  readonly velocityOffset: Vector3
  // +0x154 (0x00489660): where the particles are born.
  readonly position: Vector3
  // +0x160 (0x00489540): the rows turn a definition point into a velocity (identity until set).
  readonly basis: Matrix3
  // +0x184: milliseconds since the last birth period ended; +0x188: the emitter's age.
  readonly millisecondsSinceBirth: number
  readonly ageMilliseconds: number
}

// A slot of the pool's 100 handles (8 bytes at pool +0x14): flag bit 0 says the slot is taken.
export type EmitterHandle = {
  readonly isTaken: boolean
  readonly instanceIndex: number | null
}

export type EmitterPool = {
  readonly list: EmitterList
  readonly instances: readonly EmitterInstance[]
  readonly handles: readonly EmitterHandle[]
  // Emitters_Load's fourth argument: the table the particles' entries index.
  readonly animation: MaterialAnimation | null
}

// The two pools of a race: the common one (race +0x2150, EMITTER.EMB, where vehicles and power-ups spawn) and the
// track's (race +0x248c, the race's own file), each absent when the race has no emitter file.
export type EmitterPools = {
  readonly common: EmitterPool | null
  readonly track: EmitterPool | null
}

// What an owner of a running emitter holds (the handle pointer 0x00489d70 returns): the pool and the handle slot.
export type EmitterReference = {
  readonly isCommonPool: boolean
  readonly handleIndex: number
}

export type EmitterPoolInput = {
  readonly list: EmitterList
  // Emitters_Load's first argument (race +0x2150 holds 10, race +0x248c holds 4).
  readonly instanceCount: number
  readonly animation: MaterialAnimation | null
}

// Where an emitter is born and which way its points face (0x00489d70's three optional arguments).
export type EmitterPlacement = {
  readonly position: Vector3 | null
  // 0x00489540's two vectors: the facing and the up direction; both or neither.
  readonly orientation: { readonly facing: Vector3; readonly up: Vector3 } | null
}

export type EmitterSpawn = {
  readonly pool: EmitterPool
  // The handle slot, or null when nothing was created, or the emitter is a one-shot (its lifetime is finite).
  readonly handleIndex: number | null
}

export type EmitterRandom = {
  readonly table: RandomTable
  readonly position: RandomTablePosition
}

export type EmitterUpdate = {
  readonly pool: EmitterPool
  readonly position: RandomTablePosition
}

// The instance 0x00489d70 would take over, and its priority (the definition's third integer, 0 without one).
export type InstancePriority = {
  readonly index: number
  readonly priority: number
}

// An emitter after a step and the random table position after the draws the step made.
export type BirthProgress = {
  readonly instance: EmitterInstance
  readonly position: RandomTablePosition
}
