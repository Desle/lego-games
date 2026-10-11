import { getMenuCamera, getMenuWorldPath } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadScene } from '@lego-games/lego-racers/scene'
import {
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { MenuViewport } from './menu-viewport.types.ts'

// The engine's worlds are Z-up (default instance up (0, 0, 1), GolDP.dll 0x1002cc30).
const WORLD_UP = new Vector3(0, 0, 1)

type MenuWorld = {
  readonly three: ThreeScene
  readonly object: SceneObject
}

export const createMenuViewport = (archive: JamArchive): MenuViewport => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(1)
  const camera = new PerspectiveCamera()
  camera.up.copy(WORLD_UP)
  const worlds = new Map<string, MenuWorld | null>()

  const createWorld = (path: string): MenuWorld | null => {
    try {
      const object = createSceneObject(loadScene(archive, [path]), {
        includeInstance: () => true,
        isBackground: false,
      })
      const three = new ThreeScene()
      three.add(object.group)
      return { three, object }
    } catch {
      return null
    }
  }

  const getWorld = (path: string): MenuWorld | null => {
    if (!worlds.has(path)) worlds.set(path, createWorld(path))
    return worlds.get(path) ?? null
  }

  const draw: MenuViewport['draw'] = (context, command, deltaMilliseconds) => {
    const path = getMenuWorldPath(command.modelName)
    const world = path === null ? null : getWorld(path)
    const { left, top, right, bottom } = command.rectangle
    const width = right - left
    const height = bottom - top
    if (world === null || width <= 0 || height <= 0) return false
    const menuCamera = getMenuCamera(command.camera)
    renderer.setSize(width, height, false)
    camera.fov = menuCamera.fieldOfViewDegrees
    camera.aspect = width / height
    camera.near = menuCamera.nearPlane
    camera.far = menuCamera.farPlane
    camera.position.set(...menuCamera.position)
    camera.lookAt(...menuCamera.target)
    camera.updateProjectionMatrix()
    world.object.animate(deltaMilliseconds)
    renderer.render(world.three, camera)
    context.drawImage(renderer.domElement, left, top, width, height)
    return true
  }

  return Object.freeze({
    draw,
    dispose: () => {
      for (const world of worlds.values()) world?.object.dispose()
      worlds.clear()
      renderer.dispose()
    },
  })
}
