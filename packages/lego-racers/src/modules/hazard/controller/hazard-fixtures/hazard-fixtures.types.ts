import type { EmitterPool } from '../../../emitter/index.ts'
import type { LineProbe } from '../../../projectiles/index.ts'
import type { WorldAnimation } from '../../../world-animation/index.ts'
import type {
  HazardEffect,
  HazardSession,
  HazardWorldKey,
} from '../../types/hazard-runtime.types.ts'

export type TestSessionOptions = {
  readonly track?: WorldAnimation
  readonly blended?: WorldAnimation
  readonly emitters?: EmitterPool | null
  readonly draws?: readonly number[]
  readonly probe?: LineProbe
}

export type TestSession = {
  readonly session: HazardSession
  // The bus calls, in order, as `start 3`, `startStop 3 4` and `stop 3`.
  readonly calls: readonly string[]
  readonly effects: readonly HazardEffect[]
  readonly getWorld: (key: HazardWorldKey) => WorldAnimation
  readonly getDrawCount: () => number
  readonly getEmitters: () => EmitterPool | null
}
