import type { Material } from 'three'
import type { DetailSwitch } from '../detail-switch/detail-switch.ts'

export type MaterialSet = {
  readonly getCopy: (source: Material) => Material
  readonly dispose: () => void
}

export type DetailedPart = {
  readonly object: DetailSwitch
  // Resolves when the plain-stud model is drawn.
  readonly shown: Promise<void>
}
