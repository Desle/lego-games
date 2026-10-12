import {
  getActiveCinemaActions,
  getCinemaLoopMilliseconds,
  parseCinemaDatabase,
} from '@lego-games/lego-racers/cinema'
import type { Cinema, CinemaAction, CinemaDatabase } from '@lego-games/lego-racers/cinema'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletalAnimation } from '@lego-games/lego-racers/skeletal-animation'
import { Matrix4 } from 'three'
import type { Object3D, Scene as ThreeScene } from 'three'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { CinemaStage } from './cinema-stage.types.ts'

const CINEMA_DATABASE_PATH = 'MENUDATA\\SINGRACE\\PST.CDB'
// The champion's figure plays the clips of `MENUDATA\SINGRACE\GUY1.ADB` (one per cinema, the action's flag).
const FIGURE_ANIMATION_NAME = 'SINGRACE\\GUY1'
const FIGURE_INSTANCE_NAME = 'guy1'

const readCinemaDatabase = (archive: JamArchive): CinemaDatabase | null => {
  try {
    return parseCinemaDatabase(archive.readFile(CINEMA_DATABASE_PATH))
  } catch {
    return null
  }
}

const getCinema = (database: CinemaDatabase | null, name: string): Cinema | null =>
  database?.cinemas.find((cinema) => cinema.name.toLowerCase() === name.toLowerCase()) ?? null

// The action's frame: forward and up are the instance's first and third rows, the side is up x forward (the figure of the
// race preview matches the original's bones within 3 cm with it, see menu-backdrops.md).
export const getActionMatrix = (action: CinemaAction): Matrix4 => {
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const sideX = upY * forwardZ - upZ * forwardY
  const sideY = upZ * forwardX - upX * forwardZ
  const sideZ = upX * forwardY - upY * forwardX
  const [x, y, z] = action.position
  return new Matrix4().set(
    forwardX,
    sideX,
    upX,
    x,
    forwardY,
    sideY,
    upY,
    y,
    forwardZ,
    sideZ,
    upZ,
    z,
    0,
    0,
    0,
    1
  )
}

const getNameKey = (name: string): string => name.toLowerCase()

export const createCinemaStage = (
  archive: JamArchive,
  three: ThreeScene,
  scene: Scene,
  worldObject: SceneObject
): CinemaStage => {
  const database = readCinemaDatabase(archive)
  const figureSlot = createModelSlot(three)
  let figureAnimation: SkeletalAnimation | null = null
  const camera = scene.cameras[0]
  const cameraPosition = camera === undefined ? { x: 0, y: 0, z: 0 } : camera.position

  const setSkeletonClip = (action: CinemaAction, milliseconds: number): void => {
    const instance = scene.instances.find(
      (candidate) => getNameKey(candidate.name) === getNameKey(action.instanceName)
    )
    const animation = scene.animations[instance?.levels[0]?.animationIndex ?? -1]?.animation
    if (instance === undefined || animation === undefined) return
    worldObject.setSkeletonState(
      instance.name,
      advanceSkeletonAnimation(
        createSkeletonAnimationState(animation, action.flag),
        animation,
        milliseconds
      )
    )
  }

  const showFigure = (
    partBytes: readonly number[] | null,
    action: CinemaAction | undefined,
    milliseconds: number
  ): void => {
    if (partBytes === null || action === undefined) {
      figureSlot.dispose()
      return
    }
    const figure = figureSlot.show(partBytes.join(':'), () => {
      const model = loadMenuDriverScene(archive, partBytes, FIGURE_ANIMATION_NAME)
      figureAnimation = model.scene.animations[0]?.animation ?? null
      return createModelObject(model)
    })
    figure.group.matrix.copy(getActionMatrix(action))
    figure.group.matrixWorldNeedsUpdate = true
    if (figureAnimation !== null) {
      figure.object.setAnimationState(
        advanceSkeletonAnimation(
          createSkeletonAnimationState(figureAnimation, action.flag),
          figureAnimation,
          milliseconds
        )
      )
    }
  }

  return Object.freeze({
    show: (view) => {
      const cinema = getCinema(database, view.cinemaName)
      const actions = cinema === null ? [] : getActiveCinemaActions(cinema, view.milliseconds)
      const loopMilliseconds =
        cinema === null ? 0 : getCinemaLoopMilliseconds(cinema, view.milliseconds)
      const shownActions = actions.filter(
        (action) => getNameKey(action.instanceName) !== FIGURE_INSTANCE_NAME
      )
      const activeNames = new Set(shownActions.map((action) => getNameKey(action.instanceName)))
      const children: readonly Object3D[] = worldObject.group.children
      for (const child of children) child.visible = activeNames.has(getNameKey(child.name))
      worldObject.selectLevels(cameraPosition)
      for (const child of children) {
        if (!activeNames.has(getNameKey(child.name))) child.visible = false
      }
      for (const action of shownActions) {
        const matrix = getActionMatrix(action)
        for (const child of children) {
          if (getNameKey(child.name) !== getNameKey(action.instanceName)) continue
          child.matrix.copy(matrix)
          child.matrixWorldNeedsUpdate = true
        }
        if (action.kind === 2) setSkeletonClip(action, loopMilliseconds)
      }
      showFigure(
        view.partBytes,
        actions.find((action) => getNameKey(action.instanceName) === FIGURE_INSTANCE_NAME),
        loopMilliseconds
      )
    },
  })
}
