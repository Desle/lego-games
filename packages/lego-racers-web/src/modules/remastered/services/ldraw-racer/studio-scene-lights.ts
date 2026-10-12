import { Scene } from 'three'
import type { Object3D } from 'three'
import { createStudioLights } from '../ldraw-car/ldraw-plastic.ts'

// The scene the object is in, or null while it is not in one.
const getRootScene = (object: Object3D): Scene | null => {
  let root = object
  while (root.parent !== null) root = root.parent
  return root instanceof Scene ? root : null
}

// The plastic needs light, and three.js lights every material of a scene by all of the scene's lights, so the scene gets the
// studio once, whoever asks first (a car's drawing brings its own, which lights from behind: the race looks at its cars from
// there). A figure the menus show is looked at from its front, so the studio is turned to light from there. Returns whether the
// object is in a scene that has the studio.
export const ensureStudioLights = (object: Object3D, isLitFromFront = false): boolean => {
  const scene = getRootScene(object)
  if (scene === null) return false
  const isLit = scene.getObjectByProperty('isDirectionalLight', true) !== undefined
  if (isLit) return true
  const lights = createStudioLights()
  if (isLitFromFront) {
    for (const light of lights.children) light.position.x = -light.position.x
  }
  scene.add(lights)
  return true
}
