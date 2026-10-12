import { parseChassisDatabase } from '@lego-games/lego-racers/chassis-database'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getChampionRacerAppearance,
  getRacerModelFiles,
  loadBuiltDriverScene,
  loadMenuDriverScene,
} from '@lego-games/lego-racers/racer-appearance'
import { parseDriverDatabase } from '@lego-games/lego-racers/driver-database'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
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
import { useLookFromAddress } from '../ldraw-car/ldraw-look.ts'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { RacerPartKind } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import type { RacerPartDrawingRequest } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import { createLDrawDriverDrawing } from '../ldraw-racer/ldraw-driver-drawing.ts'
import { createLDrawWheelsDrawing } from '../ldraw-racer/ldraw-wheels-drawing.ts'
import { ensureStudioLights } from '../ldraw-racer/studio-scene-lights.ts'
import type { LDrawRacerPartDrawing } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import type {
  GalleryCatalogueSlot,
  GalleryFigure,
  GalleryDriver,
  GalleryFocus,
  GalleryView,
} from './ldraw-racer-gallery-page.types.ts'

useLookFromAddress()

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

const loadArchive = async (): Promise<JamArchive> => {
  const response = await fetch(DEVELOPMENT_JAM_ROUTE)
  return openJamArchive(new Uint8Array(await response.arrayBuffer()))
}
const archivePromise = loadArchive()
const getArchive = () => archivePromise

// A blank canvas of this size that drawing into parts of it keeps.
const clearSheet = (width: number, height: number) => {
  renderer.setSize(width, height, false)
  renderer.setScissorTest(true)
  renderer.setViewport(0, 0, width, height)
  renderer.setScissor(0, 0, width, height)
  renderer.clear()
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
): Promise<GalleryDriver | null> => {
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
  clearSheet(columns * cell, rows * cell)
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

const DRIVER_DATABASE_PATH = 'GAMEDATA\\COMMON\\DRIVERS.DDB'
const RACE_DRIVER_CLIP = 9

const getDriverNames = async (): Promise<readonly string[]> => {
  const archive = await getArchive()
  return parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers.map(
    (driver) => driver.name
  )
}

// A driver of the race's database as the race draws him: the fixed model of his name on the pelvis skeleton, in the clip he sits in.
const createRaceDriver = async (driverName: string): Promise<GalleryDriver | null> => {
  const archive = await getArchive()
  const appearance = getChampionRacerAppearance(readRacerDatabases(archive.readFile), driverName, 0)
  if (appearance.driverModel === null) return null
  const model = loadModelScene(archive, getRacerModelFiles(appearance.driverModel))
  const drawing = createLDrawDriverDrawing(
    getRequest(archive, RacerPartKind.DRIVER, model, appearance.driverModel.modelName, null),
    '?hd'
  )
  const animation = model.scene.animations[0]?.animation
  if (drawing === null || animation === undefined) return null
  drawing.setAnimationState(
    advanceSkeletonAnimation(
      createSkeletonAnimationState(animation, RACE_DRIVER_CLIP),
      animation,
      0
    )
  )
  await drawing.settled
  return { scene: createSceneOf(model, drawing, false), drawing }
}

// A driver of the database as the race draws him, or as the menus' standing figure of his part bytes.
const createDriverOfName = async (
  driverName: string,
  figure: GalleryFigure
): Promise<GalleryDriver | null> => {
  if (figure === 'race') return createRaceDriver(driverName)
  const archive = await getArchive()
  const driver = parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH)).drivers.find(
    (candidate) => candidate.name === driverName
  )
  return driver === undefined ? null : createDriver('menu', driver.unreadBytes, 0, 0)
}

// A sheet of the drivers of the race's database, each as the race draws him (the order of `getDriverNames`).
const renderDriverSheet = async (
  columns: number,
  cell: number,
  view: GalleryView,
  figure: GalleryFigure
): Promise<readonly string[]> => {
  const names = await getDriverNames()
  const rows = Math.ceil(names.length / columns)
  clearSheet(columns * cell, rows * cell)
  for (const [position, name] of names.entries()) {
    const driver = await createDriverOfName(name, figure)
    if (driver === null) continue
    drawIn(
      driver.scene,
      getFramedCamera(driver.scene, VIEW_DIRECTIONS[view], 1, null),
      (position % columns) * cell,
      (rows - 1 - Math.floor(position / columns)) * cell,
      cell,
      cell
    )
    driver.drawing.dispose()
  }
  return names
}

// A champion's wheels (his chassis's) on the left and his driver on the right, as the race draws them.
const renderChampion = async (
  driverName: string,
  view: GalleryView,
  width: number,
  height: number
): Promise<boolean> => {
  const archive = await getArchive()
  const appearance = getChampionRacerAppearance(readRacerDatabases(archive.readFile), driverName, 0)
  const wheelModel = loadModelScene(archive, getRacerModelFiles(appearance.wheelModel))
  const wheels = createLDrawWheelsDrawing(
    getRequest(archive, RacerPartKind.WHEELS, wheelModel, appearance.wheelModel.modelName, null)
  )
  const driver = await createRaceDriver(driverName)
  if (wheels === null || driver === null) return false
  await wheels.settled
  clearSheet(width, height)
  const wheelScene = createSceneOf(wheelModel, wheels, false)
  drawIn(
    wheelScene,
    getFramedCamera(wheelScene, VIEW_DIRECTIONS[view], width / 2 / height, null),
    0,
    0,
    width / 2,
    height
  )
  drawIn(
    driver.scene,
    getFramedCamera(driver.scene, VIEW_DIRECTIONS[view], width / 2 / height, null),
    width / 2,
    0,
    width / 2,
    height
  )
  return true
}

// The wheels of every chassis of the race's database in a sheet (the order of the database).
const renderWheelSheet = async (
  columns: number,
  cell: number,
  view: GalleryView
): Promise<readonly string[]> => {
  const archive = await getArchive()
  const chassisList = parseChassisDatabase(archive.readFile(CHASSIS_DATABASE_PATH)).chassis
  const rows = Math.ceil(chassisList.length / columns)
  clearSheet(columns * cell, rows * cell)
  for (const [position, chassis] of chassisList.entries()) {
    const names = chassis.variants[0]
    if (names === undefined) continue
    const model = loadModelScene(archive, getRacerModelFiles(names))
    const drawing = createLDrawWheelsDrawing(
      getRequest(archive, RacerPartKind.WHEELS, model, names.modelName, null)
    )
    if (drawing === null) continue
    await drawing.settled
    const scene = createSceneOf(model, drawing, false)
    drawIn(
      scene,
      getFramedCamera(scene, VIEW_DIRECTIONS[view], 1, null),
      (position % columns) * cell,
      (rows - 1 - Math.floor(position / columns)) * cell,
      cell,
      cell
    )
    drawing.dispose()
  }
  return chassisList.map((chassis) => chassis.name)
}

Object.assign(window, {
  renderWheelSheet,
  renderWheels,
  renderDriver,
  renderCatalogueSheet,
  getDriverNames,
  renderDriverSheet,
  renderChampion,
})
