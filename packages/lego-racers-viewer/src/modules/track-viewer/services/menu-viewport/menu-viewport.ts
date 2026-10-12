import {
  getBuilderCamera,
  getMenuCamera,
  getMenuWorldPaths,
  getWorldCameraInset,
  getWorldMenuCamera,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndViewportCommand, MenuCamera } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadScene } from '@lego-games/lego-racers/scene'
import { LinearSRGBColorSpace, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three'
import { createBuilderCarView } from '../builder-car-view/builder-car-view.ts'
import type { BuilderCarView } from '../builder-car-view/builder-car-view.types.ts'
import { createDriverView } from '../driver-view/driver-view.ts'
import type { DriverView } from '../driver-view/driver-view.types.ts'
import { createShowcaseStage } from '../showcase-stage/showcase-stage.ts'
import type { ShowcaseStage } from '../showcase-stage/showcase-stage.types.ts'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { MenuViewport, MenuWorld } from './menu-viewport.types.ts'

export const createMenuViewport = (archive: JamArchive): MenuViewport => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(1)
  const camera = new PerspectiveCamera()
  const worlds = new Map<string, MenuWorld | null>()

  const createWorld = (paths: readonly string[]): MenuWorld | null => {
    try {
      const scene = loadScene(archive, paths)
      const object = createSceneObject(scene, {
        includeInstance: () => true,
        isBackground: false,
      })
      const three = new ThreeScene()
      three.add(object.group)
      let carView: BuilderCarView | null = null
      let driverView: DriverView | null = null
      let showcaseStage: ShowcaseStage | null = null
      return {
        driverView: () => {
          driverView ??= createDriverView(archive, three)
          return driverView
        },
        three,
        object,
        scene,
        showcaseStage: () => {
          driverView ??= createDriverView(archive, three)
          showcaseStage ??= createShowcaseStage(archive, three, scene, object, driverView)
          return showcaseStage
        },
        camera: scene.cameras[0] ?? null,
        carView: () => {
          carView ??= createBuilderCarView(archive, three)
          return carView
        },
      }
    } catch {
      return null
    }
  }

  const getWorld = (paths: readonly string[]): MenuWorld | null => {
    const key = paths.join(';')
    if (!worlds.has(key)) worlds.set(key, createWorld(paths))
    return worlds.get(key) ?? null
  }

  const getCamera = (command: FrontEndViewportCommand, world: MenuWorld): MenuCamera => {
    if (command.builder !== null) return getBuilderCamera(command.builder)
    const isWorldCameraUsed = getWorldCameraInset(command.modelName) !== null
    return isWorldCameraUsed && world.camera !== null
      ? getWorldMenuCamera(world.camera)
      : getMenuCamera(command.camera)
  }

  const draw: MenuViewport['draw'] = (context, command, deltaMilliseconds) => {
    const paths = getMenuWorldPaths(command.modelName)
    const world = paths === null ? null : getWorld(paths)
    const inset = getWorldCameraInset(command.modelName) ?? 0
    const left = command.rectangle.left + inset
    const top = command.rectangle.top + inset
    const width = command.rectangle.right - inset - left
    const height = command.rectangle.bottom - inset - top
    if (world === null || width <= 0 || height <= 0) return false
    world.object.animate(deltaMilliseconds)
    if (command.builder !== null) world.carView().show(command.builder)
    if (command.showcase !== null) world.showcaseStage().show(command.showcase)
    if (command.driver !== null) {
      const driverView = world.driverView()
      driverView.show(command.driver)
      driverView.animate(deltaMilliseconds)
    }
    const menuCamera = getCamera(command, world)
    renderer.setSize(width, height, false)
    camera.fov = menuCamera.fieldOfViewDegrees
    camera.aspect = menuCamera.aspectRatio ?? width / height
    camera.near = menuCamera.nearPlane
    camera.far = menuCamera.farPlane
    camera.position.set(...menuCamera.position)
    camera.up.set(...menuCamera.up)
    camera.lookAt(...menuCamera.target)
    camera.updateProjectionMatrix()
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
      renderer.forceContextLoss()
    },
  })
}
