import { parseChassisDatabase } from '@lego-games/lego-racers/chassis-database'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getRacerModelFiles,
  loadBuiltDriverScene,
  loadMenuDriverScene,
} from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from '@lego-games/lego-racers/skeletal-animation'
import {
  Box3,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { RacerPartKind } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { RacerPartDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createLDrawDriverDrawing } from '../ldraw-racer/ldraw-driver-drawing.ts'
import { createLDrawWheelsDrawing } from '../ldraw-racer/ldraw-wheels-drawing.ts'
import { ensureStudioLights } from '../ldraw-racer/studio-scene-lights.ts'
import type { LDrawRacerPartDrawing } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import type {
  GalleryCatalogueSlot,
  GalleryFigure,
  GalleryFocus,
  GalleryView,
} from './ldraw-racer-gallery-page.types.ts'

const BACKGROUND_COLOR = 0x2b3340
const FIELD_OF_VIEW = 30
const CHASSIS_DATABASE_PATH = 'GAMEDATA\\COMMON\\CHASSIS.CMB'
const DRIVER_RAW_SCALE = 1 / 64
const SLOT_POSITIONS: Readonly<Record<GalleryCatalogueSlot, number>> = {
  hat: 0,
  face: 1,
  torso: 2,
  legs: 3,
}
// Where each catalogue part is on a seated driver, raw model units.
const SLOT_FOCUS: Readonly<Record<GalleryCatalogueSlot, GalleryFocus>> = {
  hat: { target: [0, 0, 200], distance: 520 },
  face: { target: [0, 0, 195], distance: 380 },
  torso: { target: [0, 0, 100], distance: 700 },
  legs: { target: [20, 0, 25], distance: 650 },
}
const VIEW_DIRECTIONS: Readonly<Record<GalleryView, readonly [number, number, number]>> = {
  front: [0.5, -1, 0.5],
  side: [0, -1, 0.15],
  top: [0.05, -0.2, 1],
  rear: [-0.6, 1, 0.6],
  threeQuarter: [0.8, -0.8, 0.35],
  figureFront: [1, 0, 0.08],
  figureRear: [-1, 0.2, 0.2],
}
const FIGURE_FRONT: readonly [number, number, number] = [1, 0, 0.05]

const canvas = document.getElementById('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The gallery page has no canvas')
ColorManagement.enabled = false
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.outputColorSpace = LinearSRGBColorSpace
renderer.setClearColor(new Color(BACKGROUND_COLOR))

let archivePromise: Promise<JamArchive> | null = null
const getArchive = (): Promise<JamArchive> => {
  archivePromise ??= fetch(DEVELOPMENT_JAM_ROUTE)
    .then((response) => response.arrayBuffer())
    .then((buffer) => openJamArchive(new Uint8Array(buffer)))
  return archivePromise
}

const getFramedCamera = (
  scene: Scene,
  direction: readonly [number, number, number],
  aspect: number,
  focus: GalleryFocus | null
): PerspectiveCamera => {
  scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene)
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.01, 500)
  camera.up.set(0, 0, 1)
  const centre =
    focus === null
      ? box.getCenter(new Vector3())
      : new Vector3(...focus.target).multiplyScalar(DRIVER_RAW_SCALE)
  const distance =
    focus === null
      ? ((box.getSize(new Vector3()).length() / 2) * 1.2) /
        Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
      : focus.distance * DRIVER_RAW_SCALE
  const [x, y, z] = direction
  camera.position.copy(centre).addScaledVector(new Vector3(x, y, z).normalize(), distance)
  camera.lookAt(centre)
  return camera
}

const drawIn = (
  scene: Scene,
  camera: PerspectiveCamera,
  left: number,
  bottom: number,
  width: number,
  height: number
) => {
  renderer.setViewport(left, bottom, width, height)
  renderer.setScissor(left, bottom, width, height)
  renderer.render(scene, camera)
}

// A drawing in a scene, in the original's model scale, as the viewer places it.
const createSceneOf = (
  model: ModelScene,
  drawing: LDrawRacerPartDrawing,
  isLitFromFront: boolean
): Scene => {
  const scene = new Scene()
  const scaled = new Scene()
  scaled.scale.setScalar(model.meshScales[0] ?? DRIVER_RAW_SCALE)
  scaled.add(drawing.object)
  scene.add(scaled)
  ensureStudioLights(drawing.object, isLitFromFront)
  return scene
}

const getRequest = (
  archive: JamArchive,
  kind: RacerPartKind,
  model: ModelScene,
  modelName: string | null,
  partBytes: readonly number[] | null
): RacerPartDrawingRequest => ({ kind, archive, model, modelName, partBytes })

// The wheels of the chassis at this index of the race's chassis database, as LDraw parts, after the animation's first clip has run
// for this many milliseconds.
const renderWheels = async (
  chassisIndex: number,
  view: GalleryView,
  width: number,
  height: number,
  milliseconds: number
): Promise<string | null> => {
  const archive = await getArchive()
  const chassis = parseChassisDatabase(archive.readFile(CHASSIS_DATABASE_PATH)).chassis[
    chassisIndex
  ]
  const names = chassis?.variants[0]
  if (chassis === undefined || names === undefined) return null
  const model = loadModelScene(archive, getRacerModelFiles(names))
  const drawing = createLDrawWheelsDrawing(
    getRequest(archive, RacerPartKind.WHEELS, model, names.modelName, null)
  )
  if (drawing === null) return null
  const scene = createSceneOf(model, drawing, false)
  drawing.animate(milliseconds)
  await drawing.settled
  renderer.setSize(width, height, false)
  renderer.setScissorTest(false)
  drawIn(
    scene,
    getFramedCamera(scene, VIEW_DIRECTIONS[view], width / height, null),
    0,
    0,
    width,
    height
  )
  return chassis.name
}

const loadFigureModel = (
  archive: JamArchive,
  figure: GalleryFigure,
  partBytes: readonly number[]
): ModelScene =>
  figure === 'race'
    ? loadBuiltDriverScene(archive, partBytes)
    : loadMenuDriverScene(archive, partBytes, 'LEGOMAN')

const createDriver = async (
  figure: GalleryFigure,
  partBytes: readonly number[],
  clipIndex: number,
  milliseconds: number
): Promise<{ readonly scene: Scene; readonly drawing: LDrawRacerPartDrawing } | null> => {
  const archive = await getArchive()
  const model = loadFigureModel(archive, figure, partBytes)
  const drawing = createLDrawDriverDrawing(
    getRequest(archive, RacerPartKind.DRIVER, model, null, partBytes),
    '?hd'
  )
  const animation = model.scene.animations[0]?.animation
  if (drawing === null) return null
  if (animation !== undefined && model.scene.animations.length > 0) {
    drawing.setAnimationState(
      advanceSkeletonAnimation(
        createSkeletonAnimationState(animation, clipIndex),
        animation,
        milliseconds
      )
    )
  }
  await drawing.settled
  return { scene: createSceneOf(model, drawing, figure === 'menu'), drawing }
}

// One driver of five part bytes in the given pose: the clip of the figure's animation set after this many milliseconds.
const renderDriver = async (
  partBytes: readonly number[],
  figure: GalleryFigure,
  view: GalleryView,
  width: number,
  height: number,
  clipIndex: number,
  milliseconds: number
): Promise<boolean> => {
  const driver = await createDriver(figure, partBytes, clipIndex, milliseconds)
  if (driver === null) return false
  renderer.setSize(width, height, false)
  renderer.setScissorTest(false)
  drawIn(
    driver.scene,
    getFramedCamera(driver.scene, VIEW_DIRECTIONS[view], width / height, null),
    0,
    0,
    width,
    height
  )
  return true
}

// A contact sheet of catalogue parts: one seated driver for each index, the part in its slot and the base bytes elsewhere.
const renderCatalogueSheet = async (
  slot: GalleryCatalogueSlot,
  indices: readonly number[],
  base: readonly number[],
  columns: number,
  cell: number
): Promise<number> => {
  const rows = Math.ceil(indices.length / columns)
  renderer.setSize(columns * cell, rows * cell, false)
  renderer.setScissorTest(true)
  renderer.setViewport(0, 0, columns * cell, rows * cell)
  renderer.setScissor(0, 0, columns * cell, rows * cell)
  renderer.clear()
  for (const [position, index] of indices.entries()) {
    const partBytes = base.map((value, byteIndex) =>
      byteIndex === SLOT_POSITIONS[slot] ? index : value
    )
    const driver = await createDriver('race', partBytes, 9, 0)
    if (driver === null) continue
    const camera = getFramedCamera(driver.scene, FIGURE_FRONT, 1, SLOT_FOCUS[slot])
    drawIn(
      driver.scene,
      camera,
      (position % columns) * cell,
      (rows - 1 - Math.floor(position / columns)) * cell,
      cell,
      cell
    )
    driver.drawing.dispose()
  }
  return indices.length
}

Object.assign(window, { renderWheels, renderDriver, renderCatalogueSheet })
