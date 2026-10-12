import { DirectionalLight, Scene, Vector3 } from 'three'
import type { Group, Matrix4, Object3D } from 'three'
import { createStudioLights } from '../ldraw-car/ldraw-plastic.ts'

// The studio's key light comes from behind; a figure seen from its front takes it from in front of the figure and a little above.
const FRONT_KEY_POSITION = new Vector3(100, -10, 40)

// A figure the menus show stands in front of a dark backdrop, so its key is a little stronger than a car's.
const FRONT_KEY_GAIN = 1.3

// A scene that has the studio of the scene itself (not a figure's own) is searched for its lights once: every wheel and driver asks every
// frame, and a race's scene is big.
const litScenes = new WeakSet<Scene>()
const STUDIO_FLAG = 'isStudio'
const OWNER_KEY = 'studioOwner'

const getStudio = (scene: Scene): Group | null =>
  scene.children.find((child): child is Group => child.userData[STUDIO_FLAG] === true) ?? null

// The scene the object is in, or null while it is not in one.
const getRootScene = (object: Object3D): Scene | null => {
  let root = object
  while (root.parent !== null) root = root.parent
  return root instanceof Scene ? root : null
}

// The plastic needs light, and three.js lights every material of a scene by all of the scene's lights, so the scene gets the
// studio once, whoever asks first (the first car of a race moves it with itself, which lights from behind: the race looks at its cars
// from there). A figure the menus show is looked at from its front, whichever way a screen turns it, so its studio is the figure's own,
// turned to light from the figure's front. Returns whether the object is in a scene that has the studio.
export const ensureStudioLights = (object: Object3D, isLitFromFront = false): boolean => {
  const scene = getRootScene(object)
  if (scene === null) return false
  if (litScenes.has(scene)) return true
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
    object.add(lights)
    return true
  }
  Object.assign(lights.userData, { [STUDIO_FLAG]: true, [OWNER_KEY]: null })
  scene.add(lights)
  litScenes.add(scene)
  return true
}

// The studio of a scene with several LDraw cars. three.js lights every material by every light of the scene, so a studio for each car
// would multiply the lights (and the shader's work, and recompile every program each time a car comes into view or leaves it). The
// scene gets one studio, in the frame of the first car that asks (a studio that arrived first, with a wheel or a driver, is taken over
// by it), and that car moves it with itself. Hand it back with `release` when the car goes.
export const createCarStudio = () => {
  let studio: Group | null = null
  return {
    follow: (carObject: Object3D, carMatrix: Matrix4) => {
      const scene = getRootScene(carObject)
      if (scene === null) return
      const existing = getStudio(scene)
      if (existing === null) {
        studio = createStudioLights()
        Object.assign(studio.userData, { [STUDIO_FLAG]: true, [OWNER_KEY]: carObject.uuid })
        studio.matrixAutoUpdate = false
        scene.add(studio)
        litScenes.add(scene)
      } else if (existing.userData[OWNER_KEY] === null) {
        studio = existing
        Object.assign(studio.userData, { [OWNER_KEY]: carObject.uuid })
        studio.matrixAutoUpdate = false
        studio.position.set(0, 0, 0)
        studio.quaternion.identity()
      }
      if (studio === null || studio.userData[OWNER_KEY] !== carObject.uuid) return
      studio.matrix.copy(carMatrix)
      studio.matrixWorldNeedsUpdate = true
    },
    release: () => {
      const scene = studio === null ? null : getRootScene(studio)
      studio?.removeFromParent()
      if (scene !== null) litScenes.delete(scene)
      studio = null
    },
  }
}
