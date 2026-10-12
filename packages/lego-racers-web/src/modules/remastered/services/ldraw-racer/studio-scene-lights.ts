import { DirectionalLight, Scene, Vector3 } from 'three'
import type { Object3D } from 'three'
import { createStudioLights } from '../ldraw-car/ldraw-plastic.ts'

// The studio's key light comes from behind; a figure seen from its front takes it from in front of the figure and a little above.
const FRONT_KEY_POSITION = new Vector3(100, -10, 40)

// A figure the menus show stands in front of a dark backdrop, so its key is a little stronger than a car's.
const FRONT_KEY_GAIN = 1.3

// The scene the object is in, or null while it is not in one.
const getRootScene = (object: Object3D): Scene | null => {
  let root = object
  while (root.parent !== null) root = root.parent
  return root instanceof Scene ? root : null
}

// The plastic needs light, and three.js lights every material of a scene by all of the scene's lights, so the scene gets the
// studio once, whoever asks first (a car's drawing brings its own, which lights from behind: the race looks at its cars from
// there). A figure the menus show is looked at from its front, whichever way a screen turns it, so its studio is the figure's own,
// turned to light from the figure's front. Returns whether the object is in a scene that has the studio.
export const ensureStudioLights = (object: Object3D, isLitFromFront = false): boolean => {
  const scene = getRootScene(object)
  if (scene === null) return false
  const isLit = scene.getObjectByProperty('isDirectionalLight', true) !== undefined
  if (isLit) return true
  const lights = createStudioLights()
  if (isLitFromFront) {
    for (const light of lights.children) {
      if (light instanceof DirectionalLight && light.position.x < 0) {
        light.position.copy(FRONT_KEY_POSITION)
        light.intensity *= FRONT_KEY_GAIN
      }
    }
  }
  const holder: Object3D = isLitFromFront ? object : scene
  holder.add(lights)
  return true
}
