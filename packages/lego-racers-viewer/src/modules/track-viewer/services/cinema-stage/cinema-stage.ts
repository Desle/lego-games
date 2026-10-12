import {
  getActiveCinemaActions,
  getCinemaFrame,
  getCinemaLoopMilliseconds,
  parseCinemaDatabase,
} from '@lego-games/lego-racers/cinema'
import type {
  Cinema,
  CinemaAction,
  CinemaDatabase,
  CinemaLight,
} from '@lego-games/lego-racers/cinema'
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
import { createRaceParticles } from '../race-particles/race-particles.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { SceneLights } from '../scene-object/vertex-lighting.types.ts'
import type { CinemaStage, UnitVector } from './cinema-stage.types.ts'

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

const getActiveLight = (lights: readonly CinemaLight[], frame: number): CinemaLight | undefined =>
  lights.find(
    (light) => light.startFrame <= frame && frame < light.startFrame + light.durationFrames
  )

// The device's lights while the cinema runs (the listener's light entries call GolDP.dll 0x1000b000 and 0x1000b0c0 with the entry's
// colour and direction): the ambient light bytes, and the directional light that is on the timeline.
const getCinemaLights = (cinema: Cinema, milliseconds: number): SceneLights => {
  const frame = getCinemaFrame(cinema, milliseconds)
  const ambient = getActiveLight(cinema.ambientLights, frame)
  const directional = getActiveLight(cinema.directionalLights, frame)
  return {
    ambient: ambient === undefined ? [255, 255, 255] : [ambient.red, ambient.green, ambient.blue],
    directional:
      directional?.direction === null || directional === undefined
        ? []
        : [
            {
              color: [directional.red, directional.green, directional.blue],
              direction: directional.direction,
            },
          ],
  }
}

const getUnit = (vector: UnitVector): UnitVector => {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

const getNameKey = (name: string): string => name.toLowerCase()

export const createCinemaStage = (
  archive: JamArchive,
  three: ThreeScene,
  scene: Scene,
  worldObject: SceneObject
): CinemaStage => {
  const database = readCinemaDatabase(archive)
  let shiftedInstanceNames: readonly string[] = []
  const figureSlot = createModelSlot(three)
  const particles = createRaceParticles(scene)
  three.add(particles.group)
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
    milliseconds: number,
    lights: SceneLights
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
    figure.object.setLights(lights)
  }

  return Object.freeze({
    show: (view, surfaceHeightPixels) => {
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
      const shifts = view.colourShifts
      for (const name of shiftedInstanceNames) {
        if (!shifts.some((shift) => shift.instanceName === name))
          worldObject.setInstanceColourShift(name, null)
      }
      for (const shift of shifts) {
        worldObject.setInstanceColourShift(shift.instanceName, {
          shifts: shift.shifts,
          biases: shift.biases,
        })
      }
      shiftedInstanceNames = shifts.map((shift) => shift.instanceName)
      particles.update(
        view.emitterPool === null || camera === undefined ? [] : [view.emitterPool],
        {
          position: camera?.position ?? { x: 0, y: 0, z: 0 },
          forward: getUnit(camera?.forward ?? { x: 1, y: 0, z: 0 }),
          up: getUnit(camera?.up ?? { x: 0, y: 0, z: 1 }),
        },
        camera === undefined
          ? null
          : surfaceHeightPixels / (2 * Math.tan((camera.fieldOfViewDegrees * Math.PI) / 360))
      )
      showFigure(
        view.partBytes,
        actions.find((action) => getNameKey(action.instanceName) === FIGURE_INSTANCE_NAME),
        loopMilliseconds,
        cinema === null
          ? { ambient: [255, 255, 255], directional: [] }
          : getCinemaLights(cinema, view.milliseconds)
      )
    },
  })
}
