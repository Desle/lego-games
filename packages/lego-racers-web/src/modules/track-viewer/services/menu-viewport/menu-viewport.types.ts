import type { Scene } from '@lego-games/lego-racers/scene'
import type { FrontEndViewportCommand, WorldCamera } from '@lego-games/lego-racers/front-end'
import type { Scene as ThreeScene } from 'three'
import type { DriverView } from '../driver-view/driver-view.types.ts'
import type { BuilderCarView } from '../builder-car-view/builder-car-view.types.ts'
import type { CinemaStage } from '../cinema-stage/cinema-stage.types.ts'
import type { ShowcaseStage } from '../showcase-stage/showcase-stage.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'

// Draws the 3D items of the menus (a world seen from the item's camera) into a rectangle of a 2D canvas.
export type MenuViewport = {
  // False when the item names no world this port knows (the caller draws a placeholder panel).
  readonly draw: (
    context: CanvasRenderingContext2D,
    command: FrontEndViewportCommand,
    deltaMilliseconds: number,
    // Render pixels per design pixel (1 draws the 3D item at the design's own resolution).
    resolutionScale: number
  ) => boolean
  readonly dispose: () => void
}

export type MenuWorld = {
  readonly three: ThreeScene
  readonly object: SceneObject
  readonly scene: Scene
  // The racer showcase of the race select, built when it first asks.
  readonly showcaseStage: () => ShowcaseStage
  // The race preview of the race selects, built when it first asks.
  readonly cinemaStage: () => CinemaStage
  // The world's own camera (`Camera01`), when it has one.
  readonly camera: WorldCamera | null
  // The car the builder screen puts in this world (created when it first asks).
  readonly carView: () => BuilderCarView
  // The driver the editor puts in this world.
  readonly driverView: () => DriverView
  // Lets go of the world's objects and the drawings its stages asked for.
  readonly dispose: () => void
}
