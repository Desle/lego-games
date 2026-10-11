import type { Group } from 'three'
import type { SceneObject } from '../scene-object/scene-object.types.ts'

// A model drawn as three.js objects, scaled by the model's scale inside a group whose matrix the race sets every frame.
export type ModelObject = {
  readonly group: Group
  readonly object: SceneObject
}
