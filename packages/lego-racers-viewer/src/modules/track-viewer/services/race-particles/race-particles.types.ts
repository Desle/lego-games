import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { Points } from 'three'

export type RaceParticles = {
  readonly points: Points
  // Places the points at the live particles of the pools.
  readonly update: (pools: readonly (EmitterPool | null)[]) => void
  readonly dispose: () => void
}
