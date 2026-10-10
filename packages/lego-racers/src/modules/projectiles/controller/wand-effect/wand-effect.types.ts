import type { PowerUpStep } from '../../../power-ups/index.ts'
import type { WandBeam } from '../../types/wand-beam/wand-beam.types.ts'

export type BeamedStep = {
  readonly step: PowerUpStep
  readonly beam: WandBeam | null
}

// The beam the hook drew, handed back out of updatePowerUpEffect.
export type DrawnBeam = {
  beam: WandBeam | null
}
