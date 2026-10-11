import {
  getBuilderCamera,
  getMenuCamera,
  getMenuWorldPath,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadScene } from '@lego-games/lego-racers/scene'
import {
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { createBuilderCarView } from '../builder-car-view/builder-car-view.ts'
import type { BuilderCarView } from '../builder-car-view/builder-car-view.types.ts'
import { createDriverView } from '../driver-view/driver-view.ts'
import type { DriverView } from '../driver-view/driver-view.types.ts'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { MenuViewport, MenuWorld } from './menu-viewport.types.ts'

// The engine's worlds are Z-up (default instance up (0, 0, 1), GolDP.dll 0x1002cc30).
const WORLD_UP = new Vector3(0, 0, 1)
// The editor's camera looks at the middle of the figure; his feet are this far below (**hypothesis**: the model is 3 units tall).
const DRIVER_FEET_BELOW_TARGET = 1.5

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
      let carView: BuilderCarView | null = null
      let driverView: DriverView | null = null
      return {
        driverView: () => {
          driverView ??= createDriverView(archive, three)
          return driverView
        },
        three,
        object,
        carView: () => {
          carView ??= createBuilderCarView(archive, three)
          return carView
        },
      }
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
    if (command.builder !== null) world.carView().show(command.builder)
    if (command.driver !== null) {
      const [x, y, z] = getMenuCamera(command.camera).target
      world.driverView().show(command.driver, [x, y, z - DRIVER_FEET_BELOW_TARGET])
    }
    const menuCamera =
      command.builder === null ? getMenuCamera(command.camera) : getBuilderCamera(command.builder)
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
