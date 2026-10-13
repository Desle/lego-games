import type { Group, Material } from 'three'
import type { LDrawDetail } from '../../../library/index.ts'
import type { DetailSwitch } from '../detail-switch/detail-switch.ts'
import type { SplitSubModel } from '../ldraw-parse/ldraw-parse.types.ts'

export type MaterialSet = {
  readonly getCopy: (source: Material) => Material
  readonly dispose: () => void
}

export type DetailedModelSettings = {
  // The drawing's own copies of the plastic.
  readonly materials: MaterialSet
  readonly onInstance: ((copy: Group) => void) | null
  readonly onSubModels: ((subModels: readonly SplitSubModel[], detail: LDrawDetail) => void) | null
}

export type DetailedModel = {
  readonly object: DetailSwitch
  // Resolves when the plain-stud model is drawn; rejects when the library cannot build it.
  readonly shown: Promise<void>
  // Builds the logo-stud model now, if it is not built yet (what a picture of the model wants), and resolves when it is there.
  readonly refined: () => Promise<void>
  // Lets go of the prepared models the drawing copies; its own materials and copies are the caller's to free (`disposeObject`).
  readonly release: () => void
}
