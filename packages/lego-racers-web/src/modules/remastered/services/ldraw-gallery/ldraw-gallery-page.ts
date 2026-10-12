import {
  BRICK_DATABASE_PATH,
  createBuildGrid,
  loadSavedCars,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { Object3D } from 'three'
import {
  Box3,
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { createModelObject, loadEffectModel } from '../../../track-viewer/index.ts'
import { createGameBrickMeshes } from '../ldraw-car/game-brick-meshes.ts'
import { createLDrawPickupDrawing } from '../ldraw-pickup/ldraw-pickup-drawing.ts'
import { createLDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.ts'
import { GalleryMode, GalleryView } from './ldraw-gallery-page.types.ts'
import type { GalleryResult, GalleryScene, PieceSheetResult } from './ldraw-gallery-page.types.ts'

const BACKGROUND_COLOR = 0x2b3340
const FIELD_OF_VIEW = 32
const OVERLAY_COLOR = 0xff00ff
const TEST_COLOR_INDEX = 5
const VIEW_DIRECTIONS: Readonly<Record<GalleryView, readonly [number, number, number]>> = {
  [GalleryView.FRONT]: [0.55, -1, 0.7],
  [GalleryView.REAR]: [-0.6, 1, 0.6],
  [GalleryView.TOP]: [0.05, -0.2, 1],
  [GalleryView.BOTTOM]: [0.3, -0.4, -1],
  [GalleryView.SIDE]: [0.05, -1, 0.15],
}

const canvas = document.getElementById('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('ldraw-gallery.html has no canvas')
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

const prepareSheet = (width: number, height: number) => {
  renderer.setSize(width, height, false)
  renderer.setScissorTest(true)
  renderer.setClearColor(new Color(BACKGROUND_COLOR))
  renderer.clear()
}

const frameCamera = (object: Scene, view: GalleryView, aspect: number): PerspectiveCamera => {
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
  const centre = box.getCenter(new Vector3())
  const radius = box.getSize(new Vector3()).length() / 2
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.1, 1000)
  camera.up.set(0, 0, 1)
  const [x, y, z] = VIEW_DIRECTIONS[view]
  const distance = (radius * 1.25) / Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
  camera.position.copy(centre).addScaledVector(new Vector3(x, y, z).normalize(), distance)
  camera.lookAt(centre)
  return camera
}

const createDesignScene = async (
  archive: JamArchive,
  design: CarDesign,
  mode: GalleryMode
): Promise<GalleryScene> => {
  const scene = new Scene()
  const drawing = createLDrawCarDrawing({ archive, design }, mode !== GalleryMode.GAME)
  scene.add(drawing.object)
  await drawing.settled
  if (mode === GalleryMode.OVERLAY) {
    const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
    const origin = drawing.origin
    const outline = createGameBrickMeshes(archive, database, design.bricks, origin)
    for (const child of outline.children) {
      if (child instanceof Mesh)
        child.material = new MeshBasicMaterial({ color: OVERLAY_COLOR, wireframe: true })
    }
    scene.add(outline)
  }
  return { scene, unmappedNames: drawing.document.unmappedBricks.map((brick) => brick.piece.name) }
}

const renderCar = async (
  savePath: string,
  index: number,
  mode: GalleryMode,
  view: GalleryView,
  width: number,
  height: number
): Promise<GalleryResult | null> => {
  const archive = await getArchive()
  const cars = loadSavedCars((path) => archive.readFile(path), savePath)
  const car = cars[index]
  if (car?.design === null || car === undefined) return null
  const { scene, unmappedNames } = await createDesignScene(archive, car.design, mode)
  renderer.setSize(width, height, false)
  renderer.setViewport(0, 0, width, height)
  renderer.setScissorTest(false)
  renderer.render(scene, frameCamera(scene, view, width / height))
  return {
    name: car.record.name,
    brickCount: car.design.bricks.length,
    unmappedNames,
  }
}

const getSingleBrickDesign = (piece: PlacedBrick['piece']): CarDesign => ({
  bricks: [
    {
      piece,
      x: 0,
      y: 0,
      orientation: 0,
      colorIndex: TEST_COLOR_INDEX,
      unidentifiedValue: 0,
      baseHeight: 0,
    },
  ],
  grid: createBuildGrid(),
})

const renderCell = (
  scene: Scene,
  view: GalleryView,
  left: number,
  bottom: number,
  size: number
) => {
  renderer.setViewport(left, bottom, size, size)
  renderer.setScissor(left, bottom, size, size)
  renderer.render(scene, frameCamera(scene, view, 1))
}

// Every named piece alone, the game's mesh on the left and the LDraw part on the right of each pair.
const renderPieceSheet = async (
  names: readonly string[],
  columns: number,
  cellSize: number,
  view: GalleryView = GalleryView.FRONT
): Promise<PieceSheetResult> => {
  const archive = await getArchive()
  const database: BrickDatabase = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const rows = Math.ceil(names.length / columns)
  const width = columns * cellSize * 2
  const height = rows * cellSize
  prepareSheet(width, height)
  const missing: string[] = []
  for (const [position, name] of names.entries()) {
    const piece = database.pieces.find((candidate) => candidate.name === name)
    if (piece === undefined) {
      missing.push(name)
      continue
    }
    const column = position % columns
    const row = Math.floor(position / columns)
    for (const [side, mode] of [GalleryMode.GAME, GalleryMode.LDRAW].entries()) {
      const { scene } = await createDesignScene(archive, getSingleBrickDesign(piece), mode)
      const left = (column * 2 + side) * cellSize
      const bottom = height - (row + 1) * cellSize
      renderCell(scene, view, left, bottom, cellSize)
    }
  }
  return { width, height, missing }
}

const getHasMesh = (scene: Scene): boolean => {
  const meshes: Object3D[] = []
  scene.traverse((child) => {
    if (child instanceof Mesh) meshes.push(child)
  })
  return meshes.length > 0
}

// Every named effect model (`PUBRICKY:shield`: a POWERUP.WDB model and its look) alone, the game's drawing on the left of each pair and
// the LDraw one on the right.
const renderEffectSheet = async (
  names: readonly string[],
  columns: number,
  cellSize: number,
  view: GalleryView = GalleryView.FRONT
): Promise<PieceSheetResult> => {
  const archive = await getArchive()
  const rows = Math.ceil(names.length / columns)
  const width = columns * cellSize * 2
  const height = rows * cellSize
  prepareSheet(width, height)
  for (const [position, spec] of names.entries()) {
    const [modelName = '', variant = null] = spec.split(':')
    const gameScene = new Scene()
    const isSkeletal = modelName !== 'BARREL'
    gameScene.add(createModelObject(loadEffectModel(archive, modelName, isSkeletal)).group)
    const drawing = createLDrawPickupDrawing({ modelName, variant })
    const drawingScene = new Scene()
    if (drawing !== null) drawingScene.add(drawing)
    for (let attempt = 0; attempt < 50 && !getHasMesh(drawingScene); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const camera = frameCamera(gameScene, view, 1)
    for (const [side, scene] of [gameScene, drawingScene].entries()) {
      const left = ((position % columns) * 2 + side) * cellSize
      const bottom = height - (Math.floor(position / columns) + 1) * cellSize
      renderer.setViewport(left, bottom, cellSize, cellSize)
      renderer.setScissor(left, bottom, cellSize, cellSize)
      renderer.render(scene, camera)
    }
  }
  return { width, height, missing: [] }
}

const getDesignCount = async (savePath: string): Promise<number> => {
  const archive = await getArchive()
  return loadSavedCars((path) => archive.readFile(path), savePath).length
}

Object.assign(window, { renderCar, renderPieceSheet, renderEffectSheet, getDesignCount })
