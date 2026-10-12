import type { EmitterPool } from '../../emitter/index.ts'
import type { LineProbe } from '../../projectiles/index.ts'
import type { RandomTable, RandomTablePosition } from '../../random-table/index.ts'
import type { FloatArithmetic } from '../../simulation-math/index.ts'
import type { WorldAnimation } from '../../world-animation/index.ts'
import type { HazardData } from './hazard-data.types.ts'
import type { Hazard, Vector3 } from './hazard.types.ts'

// Which of the race's worlds a hazard looks its instances up in: the hazard set-up structure's +0x10 (race +0x390)
// and +0x14 (race +0x398).
export type HazardWorldKey = 'track' | 'blended'

export type HazardWorlds = Readonly<Record<HazardWorldKey, WorldAnimation>>

// A skeleton or mesh instance found by name when the hazard loaded; null when the world has no such instance (the
// original would call through a null pointer).
export type InstanceReference = {
  readonly world: HazardWorldKey
  readonly kind: 'skeleton' | 'mesh'
  readonly index: number
}

// What a hazard asks of the parts of the game the port does not simulate (sound, the power-ups' launcher effects,
// the racers' reactions, collision objects); each names the original call.
export type HazardEffect =
  | {
      readonly type: 'hazard.sound_played'
      readonly keyword: number
      readonly soundIdentifier: number
      readonly position: Vector3 | null
    }
  | {
      readonly type: 'hazard.looped_sound_started'
      readonly keyword: number
      readonly soundIdentifier: number
    }
  | { readonly type: 'hazard.looped_sound_stopped'; readonly keyword: number }
  | {
      readonly type: 'hazard.collision_object_changed'
      readonly name: string
      readonly isSolid: boolean
    }
  | {
      // 0x0045b260 (a warp), 0x0045a950 (a projectile) and 0x0045a9b0 (a hazard) of the power-up system, with the
      // hazard as the launcher (power-up system +0x1998).
      readonly type: 'hazard.power_up_activated'
      readonly keyword: number
      readonly activation: 'warp' | 'projectile' | 'hazard'
      readonly effectKind: number
      readonly racerIndex: number | null
      readonly launcher: HazardLauncher
    }
  | {
      // 0x0045b470: an explosion starts at the point where a hazard's projectile landed.
      readonly type: 'hazard.explosion_started'
      readonly keyword: number
      readonly position: Vector3
    }
  | {
      readonly type: 'hazard.racer_affected'
      readonly keyword: number
      readonly racerIndex: number
      readonly reaction: HazardReaction
      // The impulse of a flung racer, or the pull of a captured one.
      readonly vector: Vector3 | null
    }

// What a hazard's touch does to the racer: spun (car body slot 9 with 1.0, 0.01, 0), flung (spun, then slot 14, the
// velocity cleared and slot 7 with the vector), captured (racer flag 0x20000000 and the push of slot 0x48 with the
// vector) and released (flag cleared, slot 0x4c).
export type HazardReaction = 'spun' | 'flung' | 'captured' | 'released'

// The collision sphere a hazard registers with the collision registry (the shape at hazard +0x10).
export type HazardSphere = {
  readonly centre: Vector3
  readonly radius: number
}

// What the hazard hands the power-up system as its launcher: where the effect starts (or, for a warp, where it
// lands) and, for classes that give one, its direction.
export type HazardLauncher = {
  // Null where the position comes from the pose of the hazard's skeleton, which the port does not compute.
  readonly position: Vector3 | null
  readonly direction: Vector3 | null
}

// A racer as a hazard sees it (racer +0xd04 flags, +0x5c frame position, car body +0x6c0 bit 2 at +0xaa8, and the
// car body's forward speed at +0xa00).
export type HazardRacer = {
  readonly index: number
  readonly flags: number
  readonly position: Vector3
  readonly isSpinning: boolean
  readonly forwardSpeed: number
}

export type HazardRandom = {
  readonly table: RandomTable
  readonly position: RandomTablePosition
}

// What a hazard's code calls: the signal bus (0x00461ef0, 0x00462580, 0x00462140), the random table, the worlds and
// the track emitter pool, the racers, and the effects it asks for. The track session implements it.
export type HazardBus = {
  // 0x00461ef0, 0x00462580 and 0x00462140: the bus the events, hazards and timers talk over.
  readonly startSignal: (identifier: number, parameter: Vector3 | null) => void
  readonly startStopSignal: (
    startIdentifier: number,
    stopIdentifier: number,
    parameter: Vector3 | null
  ) => void
  readonly stopSignal: (identifier: number, parameter: Vector3 | null) => void
}

export type HazardSession = HazardBus & {
  readonly arithmetic: FloatArithmetic
  // The 16-bit table value after advancing the position.
  readonly drawRandomValue: () => number
  readonly getWorld: (key: HazardWorldKey) => WorldAnimation
  readonly setWorld: (key: HazardWorldKey, world: WorldAnimation) => void
  readonly getEmitters: () => EmitterPool | null
  readonly setEmitters: (pool: EmitterPool) => void
  readonly getRacer: (index: number) => HazardRacer | null
  // The cosine table at 0x004bf7ec (1,024 values, indexed with & 0x3ff).
  readonly getTableCosine: (index: number) => number
  // The line probe 0x0041f730 over the track's collision volume; a probe that never hits when the race has none.
  readonly probe: LineProbe
  readonly emit: (effect: HazardEffect) => void
}

// The pieces of the hazard set-up structure (0x00433a3e) that the loaders keep.
export type HazardLoadContext = {
  // Race_LoadTrackContent's mirror argument (set-up +0x40).
  readonly isMirrored: boolean
  readonly session: HazardSession
}

// One hazard object: its definition, the identifier the bus matches (+0x08, -1 never matches), the lifecycle
// state, and what its class keeps.
export type HazardInstance = {
  readonly definition: Hazard
  readonly identifier: number
  readonly lifecycle: number
  readonly data: HazardData
}

export type HazardRuntime = {
  readonly instances: readonly HazardInstance[]
}

// The hazards while a signal or an update walks them: handlers run and may re-enter the walk through the bus.
export type HazardStore = {
  readonly get: () => HazardRuntime
  readonly set: (runtime: HazardRuntime) => void
}
