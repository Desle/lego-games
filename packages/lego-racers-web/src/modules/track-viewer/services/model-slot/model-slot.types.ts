import type { ModelObject } from '../model-object/model-object.types.ts'

// One model shown in a scene, replaced when the key that names what it shows changes.
export type ModelSlot = {
  readonly show: (key: string, create: () => ModelObject) => ModelObject
  readonly dispose: () => void
}
