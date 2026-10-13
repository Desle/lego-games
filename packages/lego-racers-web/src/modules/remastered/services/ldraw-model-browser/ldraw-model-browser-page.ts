import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import type { Object3D } from 'three'
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Color,
  ColorManagement,
  DirectionalLight,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { createChassisFallbackText } from '../ldraw-chassis/chassis-fallback.ts'
import { LDRAW_TO_STUDS, getChassisFileName } from '../ldraw-car/ldraw-car-document.ts'
import {
  applyPlasticLook,
  createStudioLights,
  getLookPreset,
  LOOK_APPEARANCES,
  LookPreset,
  setActiveLookPreset,
} from '@lego-games/ldraw/material'
import { parseLDrawModel } from '@lego-games/ldraw/library'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import {
  DEVELOPMENT_LDRAW_MODELS_ROUTE,
  LDRAW_CHASSIS_FOLDER,
  LDRAW_MODEL_FILES_FILE,
} from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelFile } from '../ldraw-models/ldraw-model-index.types.ts'
import { loadChampionBodyFaces } from '../reference-kit/champion-body-faces.ts'
import { getReferencedChassisNames } from '../ldraw-racer-model/ldraw-racer-car.ts'
import { describeLDrawModel } from './ldraw-model-description.ts'
import type { BrowserScenes, DrawnScenes } from './ldraw-model-browser-page.types.ts'
import { setUpLDrawModelParser } from '../ldraw-worker/ldraw-model-parser.ts'

const BACKGROUND_COLOR = 0x2b3340
const FIELD_OF_VIEW = 32
const POLL_MILLISECONDS = 1500
const COLOR_CHANNEL_MAXIMUM = 255
const IDENTITY_REFERENCE = '1 16 0 0 0 1 0 0 0 1 0 0 0 1'
const LOOKS: readonly LookPreset[] = [LookPreset.MANUAL, LookPreset.PHOTO]

const getElement = (id: string): HTMLElement => {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`ldraw-models.html has no #${id}`)
  return element
}
const canvas = getElement('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#stage is not a canvas')
const bar = getElement('bar')
const info = getElement('info')

ColorManagement.enabled = false
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.outputColorSpace = LinearSRGBColorSpace
renderer.setClearColor(new Color(BACKGROUND_COLOR))
renderer.setPixelRatio(window.devicePixelRatio)

const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 2000)
camera.up.set(0, 0, 1)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

setActiveLookPreset(getLookPreset(location.search))
setUpLDrawModelParser()
let selectedPath: string | null = decodeURIComponent(location.hash.replace(/^#/, '')) || null
let files: readonly LDrawModelFile[] = []
let shown: LDrawModelFile | null = null
let scenes: DrawnScenes | null = null
let loadCounter = 0

let archivePromise: Promise<JamArchive | null> | null = null
const getArchive = (): Promise<JamArchive | null> => {
  archivePromise ??= fetch(DEVELOPMENT_JAM_ROUTE)
    .then(async (response) =>
      response.ok ? openJamArchive(new Uint8Array(await response.arrayBuffer())) : null
    )
    .catch(() => null)
  return archivePromise
}

const fetchText = async (path: string): Promise<string | null> => {
  const response = await fetch(
    `${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { cache: 'no-store' }
  )
  return response.ok ? response.text() : null
}

const getBaseName = (path: string): string =>
  (path.split('/').pop() ?? path).replace(/\.[^.]*$/, '').toLowerCase()

// A model's parts in the frame the game uses (studs, z up), its look applied.
const createLDrawObject = async (text: string): Promise<Group> => {
  const model = await parseLDrawModel(text, DEVELOPMENT_LDRAW_ROUTE)
  applyPlasticLook(model)
  const holder = new Group()
  holder.matrixAutoUpdate = false
  holder.matrix.copy(LDRAW_TO_STUDS)
  holder.add(model)
  return holder
}

const createChassisReferenceTexts = async (
  text: string,
  archive: JamArchive | null
): Promise<readonly string[]> => {
  const database =
    archive === null ? null : parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const sections = await Promise.all(
    getReferencedChassisNames(text).map(async (name) => {
      const recipePath = files.find(
        (file) =>
          file.path.toLowerCase().startsWith(`${LDRAW_CHASSIS_FOLDER}/`) &&
          getBaseName(file.path) === name
      )?.path
      const recipe = recipePath === undefined ? null : await fetchText(recipePath)
      const piece = database === null ? null : findBrickPieceByName(database, name)
      const body =
        recipe ??
        (archive === null || database === null || piece === null
          ? null
          : createChassisFallbackText(archive, database, piece))
      return body === null ? null : `0 FILE ${getChassisFileName(name)}\n${body}`
    })
  )
  return sections.filter((section): section is string => section !== null)
}

const createFacesObject = (archive: JamArchive, code: string): Group | null => {
  const champion = readRacerDatabases((path) => archive.readFile(path)).champions.champions.find(
    (candidate) => candidate.modelName.toLowerCase() === code
  )
  if (champion === undefined) return null
  const faces = loadChampionBodyFaces(archive, {
    textureDatabaseName: champion.textureDatabaseName,
    materialLibraryName: champion.materialLibraryName,
    modelName: champion.modelName,
    skeletonName: '',
    animationName: '',
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(faces.positions, 3))
  geometry.setAttribute(
    'color',
    new BufferAttribute(
      Float32Array.from(
        { length: faces.colors.length * 3 },
        (_, index) =>
          (faces.colors[Math.floor(index / 9) * 3 + (index % 3)] ?? 0) / COLOR_CHANNEL_MAXIMUM
      ),
      3
    )
  )
  geometry.computeVertexNormals()
  const group = new Group()
  group.add(new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true, flatShading: true })))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-40, -70, 100)
  group.add(new AmbientLight(0xffffff, 1.2), key, key.target)
  return group
}

// The original's model for a file named like a car code (its body mesh) or a chassis part (the game's geometry as a part).
const createOriginalObject = async (
  path: string,
  archive: JamArchive | null
): Promise<Object3D | null> => {
  if (archive === null) return null
  const name = getBaseName(path)
  const body = createFacesObject(archive, name)
  if (body !== null) return body
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const piece = findBrickPieceByName(database, name)
  if (piece === null) return null
  const part = createChassisFallbackText(archive, database, piece)
  const object = await createLDrawObject(
    `0 FILE original.ldr\n${IDENTITY_REFERENCE} ${getChassisFileName(name)}\n0 FILE ${getChassisFileName(name)}\n${part}`
  )
  object.add(createStudioLights())
  return object
}

const createScenes = async (file: LDrawModelFile): Promise<BrowserScenes | null> => {
  const text = await fetchText(file.path)
  if (text === null) return null
  const archive = await getArchive()
  const references = await createChassisReferenceTexts(text, archive)
  const model = await createLDrawObject([text, ...references].join('\n'))
  model.add(createStudioLights())
  const description = describeLDrawModel(text)
  info.textContent = [
    `${file.path}: ${String(description.partCount)} parts`,
    ...description.headerLines,
  ].join('\n')
  return { model, original: await createOriginalObject(file.path, archive) }
}

const frameCamera = (scene: Scene) => {
  scene.updateMatrixWorld(true)
  const sphere = new Box3().setFromObject(scene).getBoundingSphere(new Sphere())
  const radius = Math.max(sphere.radius, 1)
  const distance = (radius * 1.3) / Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
  camera.near = radius / 100
  camera.far = radius * 40
  camera.position
    .copy(sphere.center)
    .add(new Vector3(0.6, -1, 0.55).normalize().multiplyScalar(distance))
  controls.target.copy(sphere.center)
  controls.update()
}

const wrapInScene = (object: Object3D): Scene => {
  const scene = new Scene()
  scene.add(object)
  return scene
}

// The original's frame can sit elsewhere than the model's, so it is moved to the model's centre to share the camera.
const wrapCentredOn = (object: Object3D, target: Scene): Scene => {
  const scene = wrapInScene(object)
  const offset = new Group()
  scene.updateMatrixWorld(true)
  target.updateMatrixWorld(true)
  const centre = (box: Scene) => new Box3().setFromObject(box).getCenter(new Vector3())
  offset.position.copy(centre(target)).sub(centre(scene))
  offset.add(...scene.children)
  scene.add(offset)
  return scene
}

const showFile = async (file: LDrawModelFile) => {
  const counter = ++loadCounter
  info.textContent = `Loading ${file.path}...`
  try {
    const loaded = await createScenes(file)
    if (counter !== loadCounter) return
    const isFirstOfFile = shown?.path !== file.path
    shown = { path: file.path, modifiedMilliseconds: file.modifiedMilliseconds }
    const modelScene = loaded === null ? null : wrapInScene(loaded.model)
    scenes =
      loaded === null || modelScene === null
        ? null
        : {
            model: modelScene,
            original: loaded.original === null ? null : wrapCentredOn(loaded.original, modelScene),
          }
    if (scenes !== null && isFirstOfFile) frameCamera(scenes.model)
  } catch (error: unknown) {
    info.textContent = `Could not draw ${file.path}: ${String(error)}`
  }
}

const getSelectedFile = (): LDrawModelFile | null =>
  files.find((file) => file.path === selectedPath) ?? files[0] ?? null

const selectElement = document.createElement('select')
const lookElement = document.createElement('select')
for (const preset of LOOKS) {
  lookElement.append(
    new Option(
      LOOK_APPEARANCES[preset].label,
      preset,
      false,
      preset === getLookPreset(location.search)
    )
  )
}
bar.append(selectElement, lookElement)

const fillSelect = () => {
  const groups = new Map<string, HTMLOptGroupElement>()
  selectElement.replaceChildren()
  for (const file of files) {
    const folder = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '/'
    const group = groups.get(folder) ?? document.createElement('optgroup')
    group.label = folder
    groups.set(folder, group)
    group.append(new Option(file.path.split('/').pop() ?? file.path, file.path))
  }
  selectElement.append(...groups.values())
  selectElement.value = getSelectedFile()?.path ?? ''
}

const poll = async () => {
  try {
    const response = await fetch(`${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${LDRAW_MODEL_FILES_FILE}`, {
      cache: 'no-store',
    })
    const latest = (await response.json()) as readonly LDrawModelFile[]
    if (
      JSON.stringify(latest.map((file) => file.path)) !==
      JSON.stringify(files.map((file) => file.path))
    ) {
      files = latest
      fillSelect()
    } else {
      files = latest
    }
    const selected = getSelectedFile()
    if (
      selected !== null &&
      (shown?.path !== selected.path ||
        shown.modifiedMilliseconds !== selected.modifiedMilliseconds)
    ) {
      await showFile(selected)
    }
  } catch {
    info.textContent = 'The models route is not available (dev server only).'
  }
  setTimeout(() => void poll(), POLL_MILLISECONDS)
}

selectElement.addEventListener('change', () => {
  selectedPath = selectElement.value
  history.replaceState(null, '', `#${encodeURIComponent(selectedPath)}`)
  shown = null
  void poll()
})
lookElement.addEventListener('change', () => {
  const preset = LOOKS.find((candidate) => candidate === lookElement.value) ?? LookPreset.MANUAL
  setActiveLookPreset(preset)
  shown = null
  void poll()
})

const drawIn = (scene: Scene, left: number, width: number, height: number) => {
  renderer.setViewport(left, 0, width, height)
  renderer.setScissor(left, 0, width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

const draw = () => {
  const width = Math.max(canvas.clientWidth, 1)
  const height = Math.max(canvas.clientHeight, 1)
  renderer.setSize(width, height, false)
  renderer.setScissorTest(true)
  renderer.clear()
  controls.update()
  if (scenes !== null) {
    const half = scenes.original === null ? width : Math.floor(width / 2)
    drawIn(scenes.model, 0, half, height)
    if (scenes.original !== null) drawIn(scenes.original, half, width - half, height)
  }
  requestAnimationFrame(draw)
}

void poll()
draw()
