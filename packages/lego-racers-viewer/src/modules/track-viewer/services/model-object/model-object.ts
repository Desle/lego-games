import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Group } from 'three'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { ModelObject } from './model-object.types.ts'

// A model as three.js objects, scaled by the model's scale (GDB keyword 0x33) inside a group whose matrix the race
// sets every frame.
export const createModelObject = (model: ModelScene): ModelObject => {
  const object = createSceneObject(model.scene, {
    includeInstance: () => true,
    isBackground: false,
  })
  const group = new Group()
  group.matrixAutoUpdate = false
  const scaled = new Group()
  scaled.scale.setScalar(model.meshScales[0] ?? 1)
  scaled.add(object.group)
  group.add(scaled)
  return { group, object }
}
