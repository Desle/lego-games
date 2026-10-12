import {
  getBuilderCamera,
  getMenuCamera,
  getMenuWorldPaths,
  getWorldCameraInset,
  getWorldMenuCamera,
} from '@lego-games/lego-racers/front-end'
import type {
  CinemaSource,
  FrontEndViewportCommand,
  MenuCamera,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadScene } from '@lego-games/lego-racers/scene'
import { LinearSRGBColorSpace, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three'
import { createBuilderCarView } from '../builder-car-view/builder-car-view.ts'
import type { BuilderCarView } from '../builder-car-view/builder-car-view.types.ts'
import { createCinemaStage } from '../cinema-stage/cinema-stage.ts'
import { getCinemaWorldPaths } from '../cinema-stage/cinema-source.ts'
import type { CinemaStage } from '../cinema-stage/cinema-stage.types.ts'
import { createDriverView } from '../driver-view/driver-view.ts'
import type { DriverView } from '../driver-view/driver-view.types.ts'
import { createShowcaseStage } from '../showcase-stage/showcase-stage.ts'
import type { ShowcaseStage } from '../showcase-stage/showcase-stage.types.ts'
import { createSceneObject } from '../scene-object/scene-object.ts'
import type { MenuViewport, MenuWorld } from './menu-viewport.types.ts'

// A cinema world made without a command that names its files (never reached: a command with a cinema names them).
const RACE_PREVIEW_FALLBACK_SOURCE: CinemaSource = { directory: 'SINGRACE', fileName: 'PST' }

// The bitmaps a cinema world lacks (the figure's `cr_hat`, `cr_chst` ...) come from the menus' part database: its sizes are
// the ones the original's draws use (measured: 64 x 64 and 128 x 128 where `GAMEDATA\COMMON` has 32 x 32 and 64 x 64).
const CINEMA_TEXTURE_FALLBACKS: readonly string[] = ['MENUDATA\\PARTDB']

export const createMenuViewport = (archive: JamArchive): MenuViewport => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  // Direct3D 6 has no colour management: colours reach the screen as stored.
  renderer.outputColorSpace = LinearSRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(1)
  const camera = new PerspectiveCamera()
  const worlds = new Map<string, MenuWorld | null>()

  const createWorld = (paths: readonly string[], source: CinemaSource | null): MenuWorld | null => {
    try {
      const scene = loadScene(archive, paths, source === null ? [] : CINEMA_TEXTURE_FALLBACKS)
      const object = createSceneObject(scene, {
        includeInstance: () => true,
        isBackground: false,
      })
      const three = new ThreeScene()
      three.add(object.group)
      let carView: BuilderCarView | null = null
      let driverView: DriverView | null = null
      let showcaseStage: ShowcaseStage | null = null
      let cinemaStage: CinemaStage | null = null
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
        cinemaStage: () => {
          cinemaStage ??= createCinemaStage(
            archive,
            three,
            scene,
            object,
            source ?? RACE_PREVIEW_FALLBACK_SOURCE
          )
          return cinemaStage
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

  const getWorld = (paths: readonly string[], source: CinemaSource | null): MenuWorld | null => {
    const key = paths.join(';')
    if (!worlds.has(key)) worlds.set(key, createWorld(paths, source))
    return worlds.get(key) ?? null
  }

  const getCamera = (command: FrontEndViewportCommand, world: MenuWorld): MenuCamera => {
    if (command.builder !== null) return getBuilderCamera(command.builder)
    const isWorldCameraUsed = getWorldCameraInset(command.modelName) !== null
    return isWorldCameraUsed && world.camera !== null
      ? getWorldMenuCamera(world.camera)
      : getMenuCamera(command.camera)
  }

  const draw: MenuViewport['draw'] = (context, command, deltaMilliseconds, resolutionScale) => {
    const { cinema } = command
    const paths =
      cinema === null
        ? getMenuWorldPaths(command.modelName)
        : getCinemaWorldPaths(archive, cinema.source)
    const world = paths === null ? null : getWorld(paths, cinema?.source ?? null)
    const inset = cinema === null ? (getWorldCameraInset(command.modelName) ?? 0) : 0
    const left = command.rectangle.left + inset
    const top = command.rectangle.top + inset
    const width = command.rectangle.right - inset - left
    const height = command.rectangle.bottom - inset - top
    if (world === null || width <= 0 || height <= 0) return false
    world.object.animate(deltaMilliseconds)
    if (command.builder !== null) world.carView().show(command.builder)
    if (command.showcase !== null) world.showcaseStage().show(command.showcase)
    const cinemaCamera = cinema === null ? null : world.cinemaStage().show(cinema)
    if (command.driver !== null) {
      const driverView = world.driverView()
      driverView.show(command.driver)
      driverView.animate(deltaMilliseconds)
    }
    const menuCamera =
      cinemaCamera === null ? getCamera(command, world) : getWorldMenuCamera(cinemaCamera)
    renderer.setSize(
      Math.round(width * resolutionScale),
      Math.round(height * resolutionScale),
      false
    )
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
