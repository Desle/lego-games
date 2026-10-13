import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  Box3,
  Box3Helper,
  Color,
  ColorManagement,
  GridHelper,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'
import type { Camera, Object3D } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { useLookFromAddress } from '../ldraw-car/ldraw-look.ts'
import { createStudioLights } from '../ldraw-car/ldraw-plastic.ts'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import {
  DEVELOPMENT_LDRAW_MODELS_ROUTE,
  LDRAW_MODEL_FILES_FILE,
} from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelFile } from '../ldraw-models/ldraw-model-index.types.ts'
import { parseBrickColorNames } from '../reference-kit/ldraw-color-names.ts'
import type { LDrawColorName } from '../reference-kit/reference-kit.types.ts'
import { serializeBuilderDocument, turnQuarter } from './builder-document.ts'
import {
  createBuilderHistory,
  pushBuilderHistory,
  redoBuilderHistory,
  undoBuilderHistory,
} from './builder-history.ts'
import { getBuilderItems, getNextBuilderItem } from './builder-items.ts'
import { createBuilderPanel } from './builder-panel.ts'
import { ReferenceMode } from './builder-panel.types.ts'
import { createGhostInstance, createPartInstance, createPartTemplates } from './builder-parts.ts'
import {
  getGroundPhase,
  getPartPhase,
  getPlacedBox,
  getPlacementPosition,
  getRotatedBox,
  PLATE_HEIGHT,
  STUD_WIDTH,
} from './builder-placement.ts'
import {
  createOriginalReference,
  createWheelGuides,
  getChampionChassis,
  loadBuilderItemStart,
} from './builder-reference.ts'
import type { BuilderItemStart, OriginalReference } from './builder-reference.types.ts'
import {
  BUILDER_PARTS_FILE,
  BUILDER_PROGRESS_FILE,
  BUILDER_SAVE_PATH,
  DEVELOPMENT_LDRAW_BUILDER_ROUTE,
} from './ldraw-builder-route.ts'
import type {
  BuilderBox,
  BuilderPart,
  BuilderProgress,
  LibraryPart,
} from './ldraw-builder.types.ts'
import type { BuilderItem, BuilderSaveResult, Vector } from './ldraw-builder.types.ts'
import type { BuilderTool, PointerHit, PointerPosition } from './ldraw-builder-page.types.ts'

const BACKGROUND_COLOR = 0x2b3340
const SELECTION_COLOR = 0xffd400
const GRID_COLOR = 0x5a6578
const FIELD_OF_VIEW = 32
const GHOST_REFERENCE_OPACITY = 0.45
const CLICK_DISTANCE = 5
const GRID_STUDS = 40
const FRAME_MARGIN = 1.4
const VIEW_DIRECTION = new Vector3(0.7, -1, 0.6).normalize()
const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const DEFAULT_TOOL: BuilderTool = {
  partName: '3001.dat',
  colorCode: 4,
  rotation: IDENTITY_ROTATION,
}
const REFERENCE_MODES: readonly ReferenceMode[] = Object.values(ReferenceMode)

useLookFromAddress()

const findElement = (id: string): HTMLElement => {
  const found = document.getElementById(id)
  if (found === null) throw new Error(`ldraw-builder.html is missing #${id}`)
  return found
}
const canvas = findElement('stage')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#stage must be a canvas')

ColorManagement.enabled = false
const renderer = new WebGLRenderer({ canvas, antialias: true })
renderer.outputColorSpace = LinearSRGBColorSpace
renderer.setClearColor(new Color(BACKGROUND_COLOR))
renderer.setPixelRatio(window.devicePixelRatio)

const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.05, 1000)
camera.up.set(0, 0, 1)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

const buildScene = new Scene()
const ldrawFrame = new Group()
ldrawFrame.matrixAutoUpdate = false
ldrawFrame.matrix.copy(LDRAW_TO_STUDS)
const lockedGroup = new Group()
const editFrame = new Group()
const partsGroup = new Group()
const grid = new GridHelper(GRID_STUDS * STUD_WIDTH, GRID_STUDS, GRID_COLOR, GRID_COLOR)
grid.raycast = () => undefined
editFrame.add(partsGroup, grid)
ldrawFrame.add(lockedGroup, editFrame)
const guidesHolder = new Group()
const selectionHelper = new Box3Helper(new Box3(), SELECTION_COLOR)
selectionHelper.visible = false
buildScene.add(createStudioLights(), ldrawFrame, guidesHolder, selectionHelper)
const referenceScene = new Scene()

const overlayTarget = new WebGLRenderTarget(1, 1)
const overlayScene = new Scene()
const overlayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
overlayScene.add(
  new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({
      map: overlayTarget.texture,
      transparent: true,
      opacity: GHOST_REFERENCE_OPACITY,
      depthTest: false,
      depthWrite: false,
    })
  )
)

const panel = createBuilderPanel(
  {
    queue: findElement('queue'),
    bar: findElement('bar'),
    palette: findElement('palette'),
    help: findElement('help'),
    status: findElement('status'),
  },
  {
    onItemSelect: (itemId) => void selectItem(itemId),
    onStartFileSelect: (file) => void restartItem(file),
    onReferenceModeSelect: (mode) => setReferenceMode(mode),
    onPartSelect: (partName) => setToolPart(partName),
    onColorSelect: (colorCode) => chooseColor(colorCode),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onRotate: () => rotate(),
    onDeleteSelected: () => deleteSelected(),
    onDone: () => void finishItem(),
  }
)

const templates = createPartTemplates()
let archive: JamArchive | null = null
let items: readonly BuilderItem[] = []
let progress: BuilderProgress = { done: [] }
let libraryParts: readonly LibraryPart[] = []
let colors: readonly LDrawColorName[] = []
let currentItem: BuilderItem | null = null
let start: BuilderItemStart | null = null
let history = createBuilderHistory([])
let savedParts: readonly BuilderPart[] = []
let tool = DEFAULT_TOOL
let selectedIndex: number | null = null
let referenceMode: ReferenceMode = ReferenceMode.SIDE
let reference: OriginalReference | null = null
let ghost: Group | null = null
let ghostKey = ''
let ghostPosition: Vector | null = null
let pointer: PointerPosition | null = null
let isSyncScheduled = false
let isSaving = false

const getIsDirty = () => history.present !== savedParts

const getTemplateBox = (part: BuilderPart): BuilderBox | null =>
  templates.getLoaded(part.partName, part.colorCode)?.box ?? null

const getDescription = (partName: string) =>
  libraryParts.find((part) => part.name.toLowerCase() === partName.toLowerCase())?.description ?? ''

const showStatus = () => {
  const parts = history.present
  const missing = parts.filter(
    (part) => templates.getLoaded(part.partName, part.colorCode) === null
  )
  const selected = selectedIndex === null ? undefined : parts[selectedIndex]
  panel.showStatus(
    [
      start?.file ?? '',
      `${String(parts.length)} parts`,
      missing.length > 0
        ? `${String(missing.length)} not in the library (${[...new Set(missing.map((part) => part.partName))].join(', ')})`
        : '',
      selected === undefined
        ? ''
        : `selected ${selected.partName} (${String(selected.colorCode)}) at ${selected.position.join(' ')}`,
      getIsDirty() ? 'unsaved changes' : 'saved',
    ]
      .filter((text) => text !== '')
      .join(' · ')
  )
}

const showTool = () =>
  panel.showTool({
    partName: tool.partName,
    description: getDescription(tool.partName),
    colorCode: tool.colorCode,
    colorName: colors.find((color) => color.code === tool.colorCode)?.name ?? '',
  })

const scheduleSync = () => {
  if (isSyncScheduled) return
  isSyncScheduled = true
  requestAnimationFrame(() => {
    isSyncScheduled = false
    syncScene()
  })
}

// Puts a copy of each part's template where the part is; a template that has not arrived yet is asked for and the scene follows.
const fillGroup = (group: Group, parts: readonly BuilderPart[], isEditable: boolean) => {
  group.clear()
  parts.forEach((part, index) => {
    const template = templates.getLoaded(part.partName, part.colorCode)
    if (template === undefined) {
      void templates.load(part.partName, part.colorCode).then(scheduleSync)
      return
    }
    if (template === null) return
    const instance = createPartInstance(template, part)
    instance.userData = isEditable ? { partIndex: index } : { lockedIndex: index }
    group.add(instance)
  })
}

const syncSelection = () => {
  const instance = partsGroup.children.find(
    (child) => child.userData['partIndex'] === selectedIndex && selectedIndex !== null
  )
  selectionHelper.visible = instance !== undefined
  if (instance !== undefined) {
    buildScene.updateMatrixWorld(true)
    selectionHelper.box.setFromObject(instance)
  }
}

const syncScene = () => {
  fillGroup(partsGroup, history.present, true)
  fillGroup(lockedGroup, start?.lockedParts ?? [], false)
  syncSelection()
  syncGhost()
  showStatus()
}

const getOwner = (object: Object3D | null): Object3D | null => {
  let current = object
  while (
    current !== null &&
    !('partIndex' in current.userData || 'lockedIndex' in current.userData)
  ) {
    current = current.parent
  }
  return current
}

const getGroundHeight = (): number =>
  Math.max(
    0,
    ...(start?.lockedParts ?? []).map((part) => {
      const box = getTemplateBox(part)
      return box === null ? 0 : getPlacedBox(box, part).maximum[1] - (start?.editOffset[1] ?? 0)
    })
  )

const getViewWidth = (): number =>
  referenceMode === ReferenceMode.SIDE && reference !== null
    ? Math.floor(canvas.clientWidth / 2)
    : canvas.clientWidth

const getRay = (position: PointerPosition): Raycaster | null => {
  const bounds = canvas.getBoundingClientRect()
  const width = getViewWidth()
  const x = position.clientX - bounds.left
  if (x > width) return null
  const raycaster = new Raycaster()
  raycaster.setFromCamera(
    new Vector2((x / width) * 2 - 1, -((position.clientY - bounds.top) / bounds.height) * 2 + 1),
    camera
  )
  return raycaster
}

const toEditFrame = (point: Vector3): Vector =>
  [...editFrame.worldToLocal(point.clone()).toArray()] as const

// The face under the cursor in the editing frame, with the grid of the part it belongs to; the ground when there is none.
const getPointerHit = (position: PointerPosition): PointerHit | null => {
  const raycaster = getRay(position)
  if (raycaster === null) return null
  buildScene.updateMatrixWorld(true)
  const toEdit = editFrame.matrixWorld.clone().invert()
  const hit = raycaster
    .intersectObjects([partsGroup, lockedGroup], true)
    .find((intersection) => intersection.object instanceof Mesh && intersection.face != null)
  const owner = getOwner(hit?.object ?? null)
  if (hit !== undefined && hit.face != null && owner !== null) {
    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    if (worldNormal.dot(raycaster.ray.direction) > 0) worldNormal.negate()
    const normal = worldNormal.transformDirection(toEdit)
    const partIndex: unknown = owner.userData['partIndex']
    const lockedIndex: unknown = owner.userData['lockedIndex']
    const part =
      typeof partIndex === 'number'
        ? history.present[partIndex]
        : typeof lockedIndex === 'number'
          ? start?.lockedParts[lockedIndex]
          : undefined
    const box = part === undefined ? null : getTemplateBox(part)
    if (part !== undefined && box !== null) {
      const lockedOffset = start?.editOffset ?? [0, 0, 0]
      const framePart =
        typeof partIndex === 'number'
          ? part
          : {
              ...part,
              position: [
                part.position[0] - lockedOffset[0],
                part.position[1] - lockedOffset[1],
                part.position[2] - lockedOffset[2],
              ] as const,
            }
      return {
        target: {
          point: toEditFrame(hit.point),
          normal: [normal.x, normal.y, normal.z],
          phase: getPartPhase(box, framePart),
        },
        partIndex: typeof partIndex === 'number' ? partIndex : null,
        part,
      }
    }
  }
  const groundHeight = getGroundHeight()
  const ray = raycaster.ray.clone().applyMatrix4(toEdit)
  const ground = ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -groundHeight), new Vector3())
  return ground === null
    ? null
    : {
        target: {
          point: [ground.x, ground.y, ground.z],
          normal: [0, -1, 0],
          phase: getGroundPhase(groundHeight),
        },
        partIndex: null,
        part: null,
      }
}

const removeGhost = () => {
  if (ghost !== null) editFrame.remove(ghost)
  ghost = null
  ghostKey = ''
}

const syncGhost = () => {
  const template = templates.getLoaded(tool.partName, tool.colorCode)
  if (template === undefined) void templates.load(tool.partName, tool.colorCode).then(scheduleSync)
  const hit = pointer === null ? null : getPointerHit(pointer)
  if (template == null || hit === null) {
    removeGhost()
    ghostPosition = null
    return
  }
  ghostPosition = getPlacementPosition(hit.target, getRotatedBox(template.box, tool.rotation))
  const part = { ...tool, position: ghostPosition }
  const key = `${tool.partName}|${String(tool.colorCode)}`
  if (ghost === null || key !== ghostKey) {
    removeGhost()
    ghost = createGhostInstance(template, part)
    ghostKey = key
    editFrame.add(ghost)
  }
  ghost.matrix.copy(createPartInstance(template, part).matrix)
}

const commit = (parts: readonly BuilderPart[]) => {
  history = pushBuilderHistory(history, Object.freeze(parts))
  syncScene()
}

const replacePart = (index: number, change: (part: BuilderPart) => BuilderPart) =>
  commit(history.present.map((part, partIndex) => (partIndex === index ? change(part) : part)))

const placePart = () => {
  if (ghostPosition === null) return
  const position = ghostPosition
  commit([...history.present, Object.freeze({ ...tool, position, commentLines: [] })])
}

const setTool = (next: BuilderTool) => {
  tool = next
  showTool()
  syncGhost()
}

const setToolPart = (partName: string) => setTool({ ...tool, partName })

const chooseColor = (colorCode: number) => {
  setTool({ ...tool, colorCode })
  if (selectedIndex !== null) replacePart(selectedIndex, (part) => ({ ...part, colorCode }))
}

const setSelectedIndex = (index: number | null) => {
  selectedIndex = index
  syncSelection()
  showStatus()
}

const rotate = () =>
  selectedIndex === null
    ? setTool({ ...tool, rotation: turnQuarter(tool.rotation) })
    : replacePart(selectedIndex, (part) => ({ ...part, rotation: turnQuarter(part.rotation) }))

const deleteAt = (index: number) => {
  selectedIndex = null
  commit(history.present.filter((_part, partIndex) => partIndex !== index))
}

const deleteSelected = () => {
  if (selectedIndex !== null) deleteAt(selectedIndex)
}

const nudge = (offset: Vector) => {
  if (selectedIndex === null) return
  replacePart(selectedIndex, (part) => ({
    ...part,
    position: [
      part.position[0] + offset[0],
      part.position[1] + offset[1],
      part.position[2] + offset[2],
    ] as const,
  }))
}

const pickUpSelected = () => {
  const part = selectedIndex === null ? undefined : history.present[selectedIndex]
  if (part === undefined || selectedIndex === null) return
  setTool({ partName: part.partName, colorCode: part.colorCode, rotation: part.rotation })
  deleteAt(selectedIndex)
}

const undo = () => {
  history = undoBuilderHistory(history)
  selectedIndex = null
  syncScene()
}

const redo = () => {
  history = redoBuilderHistory(history)
  selectedIndex = null
  syncScene()
}

const takeFromPointer = (isWholePart: boolean) => {
  const part = pointer === null ? null : (getPointerHit(pointer)?.part ?? null)
  if (part === null) return
  setTool(
    isWholePart
      ? { partName: part.partName, colorCode: part.colorCode, rotation: part.rotation }
      : { ...tool, colorCode: part.colorCode }
  )
}

const deleteAtPointer = () => {
  const index = pointer === null ? null : (getPointerHit(pointer)?.partIndex ?? null)
  if (index !== null) deleteAt(index)
}

const selectAtPointer = () =>
  setSelectedIndex(pointer === null ? null : (getPointerHit(pointer)?.partIndex ?? null))

const setReferenceMode = (mode: ReferenceMode) => {
  referenceMode = mode
  panel.showReferenceMode(mode)
}

const cycleReferenceMode = () =>
  setReferenceMode(
    REFERENCE_MODES[(REFERENCE_MODES.indexOf(referenceMode) + 1) % REFERENCE_MODES.length] ??
      ReferenceMode.SIDE
  )

const frameCamera = () => {
  buildScene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(partsGroup).union(new Box3().setFromObject(lockedGroup))
  if (reference !== null) box.union(new Box3().setFromObject(reference.object))
  if (box.isEmpty()) box.setFromCenterAndSize(new Vector3(), new Vector3(8, 6, 3))
  const centre = box.getCenter(new Vector3())
  const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1)
  const distance = (radius * FRAME_MARGIN) / Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
  controls.target.copy(centre)
  camera.position.copy(centre).addScaledVector(VIEW_DIRECTION, distance)
  camera.near = distance / 100
  camera.far = distance * 20
  camera.updateProjectionMatrix()
  controls.update()
}

const fetchJson = async <Value>(url: string, fallback: Value): Promise<Value> => {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    return response.ok ? ((await response.json()) as Value) : fallback
  } catch {
    return fallback
  }
}

const showStartFiles = async (item: BuilderItem) => {
  const files = await fetchJson<readonly LDrawModelFile[]>(
    `${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${LDRAW_MODEL_FILES_FILE}`,
    []
  )
  const name = item.name.toLowerCase()
  panel.showStartFiles(
    files
      .map((file) => file.path)
      .filter((path) => (path.split('/').pop() ?? '').toLowerCase().startsWith(name)),
    start?.sourceFile ?? null
  )
}

const showQueue = () =>
  panel.showQueue({ items, done: progress.done, currentId: currentItem?.id ?? '' })

const replaceAddressHash = (itemId: string) =>
  window.history.replaceState(null, '', `#${encodeURIComponent(itemId)}`)

const openItem = async (item: BuilderItem, startFile: string | null) => {
  if (archive === null) return
  currentItem = item
  panel.showStatus(`Loading ${item.name}…`)
  showQueue()
  start = await loadBuilderItemStart(archive, item, startFile)
  history = createBuilderHistory(start.document.parts)
  savedParts = history.present
  selectedIndex = null
  editFrame.position.set(...start.editOffset)
  editFrame.updateMatrix()
  reference?.dispose()
  reference = createOriginalReference(archive, item)
  referenceScene.clear()
  if (reference !== null) referenceScene.add(reference.object)
  guidesHolder.clear()
  if (item.chassisName !== '') guidesHolder.add(createWheelGuides(archive, item.chassisName))
  history.present.forEach((part) => void templates.load(part.partName, part.colorCode))
  await Promise.all(
    [...history.present, ...start.lockedParts].map((part) =>
      templates.load(part.partName, part.colorCode)
    )
  )
  syncScene()
  frameCamera()
  replaceAddressHash(item.id)
  await showStartFiles(item)
}

const getIsLeaveAllowed = () =>
  !getIsDirty() || window.confirm('This model has unsaved changes. Leave it anyway?')

const selectItem = async (itemId: string) => {
  const item = items.find((candidate) => candidate.id === itemId)
  if (item !== undefined && getIsLeaveAllowed()) await openItem(item, null)
}

const restartItem = async (file: string | null) => {
  if (currentItem !== null && getIsLeaveAllowed()) await openItem(currentItem, file)
}

const postModel = async (itemId: string, text: string): Promise<BuilderSaveResult | string> => {
  const response = await fetch(`${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/${BUILDER_SAVE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, text }),
  })
  return response.ok ? ((await response.json()) as BuilderSaveResult) : response.text()
}

// Done: the model goes into the models folder (the old file to a backup first), the item is marked done, and the next one opens.
const finishItem = async () => {
  if (currentItem === null || start === null || isSaving) return
  isSaving = true
  panel.setIsBusy(true)
  try {
    const text = serializeBuilderDocument({ ...start.document, parts: history.present })
    const result = await postModel(currentItem.id, text)
    if (typeof result === 'string') {
      panel.showStatus(`Not saved: ${result}`)
      return
    }
    savedParts = history.present
    progress = result.progress
    const next = getNextBuilderItem(items, currentItem.id, progress.done)
    if (next === null) {
      showQueue()
      panel.showStatus(`Saved ${result.path} · every item is done`)
      return
    }
    await openItem(next, null)
  } finally {
    isSaving = false
    panel.setIsBusy(false)
  }
}

const getIsTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement

const onKeyDown = (event: KeyboardEvent) => {
  if (getIsTyping(event.target)) return
  const isCommand = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  const actions: Readonly<Record<string, () => void>> = isCommand
    ? { z: event.shiftKey ? redo : undo, y: redo }
    : {
        r: rotate,
        delete: deleteSelected,
        backspace: deleteSelected,
        x: deleteAtPointer,
        c: () => takeFromPointer(false),
        q: () => takeFromPointer(true),
        m: pickUpSelected,
        escape: () => setSelectedIndex(null),
        g: cycleReferenceMode,
        w: () => void (guidesHolder.visible = !guidesHolder.visible),
        f: frameCamera,
        arrowleft: () => nudge([-STUD_WIDTH, 0, 0]),
        arrowright: () => nudge([STUD_WIDTH, 0, 0]),
        arrowup: () => nudge([0, 0, -STUD_WIDTH]),
        arrowdown: () => nudge([0, 0, STUD_WIDTH]),
        '[': () => nudge([0, PLATE_HEIGHT, 0]),
        ']': () => nudge([0, -PLATE_HEIGHT, 0]),
      }
  const action = actions[key]
  if (action === undefined) return
  event.preventDefault()
  action()
}

let pressed: PointerPosition | null = null

const onPointerMove = (event: PointerEvent) => {
  pointer = { clientX: event.clientX, clientY: event.clientY }
  syncGhost()
}

const onPointerDown = (event: PointerEvent) => {
  pressed = { clientX: event.clientX, clientY: event.clientY }
}

const getIsClick = (event: PointerEvent) =>
  event.button === 0 &&
  pressed !== null &&
  Math.hypot(event.clientX - pressed.clientX, event.clientY - pressed.clientY) < CLICK_DISTANCE

const onPointerUp = (event: PointerEvent) => {
  if (!getIsClick(event)) return
  if (event.shiftKey) selectAtPointer()
  else if (event.altKey) takeFromPointer(false)
  else placePart()
}

const onPointerLeave = () => {
  pointer = null
  syncGhost()
}

window.addEventListener('keydown', onKeyDown)
canvas.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('pointerdown', onPointerDown)
canvas.addEventListener('pointerup', onPointerUp)
canvas.addEventListener('pointerleave', onPointerLeave)

const renderView = (
  scene: Scene,
  viewCamera: Camera,
  left: number,
  width: number,
  height: number
) => {
  renderer.setViewport(left, 0, width, height)
  renderer.setScissor(left, 0, width, height)
  renderer.render(scene, viewCamera)
}

const renderGhostReference = (width: number, height: number) => {
  const size = renderer.getDrawingBufferSize(new Vector2())
  overlayTarget.setSize(size.x, size.y)
  renderer.setRenderTarget(overlayTarget)
  renderer.setClearAlpha(0)
  renderer.clear()
  renderer.render(referenceScene, camera)
  renderer.setRenderTarget(null)
  renderer.setClearAlpha(1)
  renderer.autoClear = false
  renderView(overlayScene, overlayCamera, 0, width, height)
  renderer.autoClear = true
}

const draw = () => {
  controls.update()
  const { width, height } = canvas.getBoundingClientRect()
  renderer.setSize(Math.max(width, 1), Math.max(height, 1), false)
  renderer.setScissorTest(true)
  renderer.clear()
  const viewWidth = getViewWidth()
  camera.aspect = viewWidth / height
  camera.updateProjectionMatrix()
  renderView(buildScene, camera, 0, viewWidth, height)
  if (reference !== null && referenceMode === ReferenceMode.SIDE) {
    renderView(referenceScene, camera, viewWidth, width - viewWidth, height)
  } else if (reference !== null && referenceMode === ReferenceMode.GHOST) {
    renderGhostReference(width, height)
  }
  requestAnimationFrame(draw)
}

const loadColors = async (): Promise<readonly LDrawColorName[]> => {
  const response = await fetch(`${DEVELOPMENT_LDRAW_ROUTE}/LDConfig.ldr`)
  return response.ok ? parseBrickColorNames(await response.text()) : []
}

const run = async () => {
  panel.showStatus('Reading LEGO.JAM…')
  const response = await fetch(DEVELOPMENT_JAM_ROUTE)
  if (!response.ok) {
    panel.showStatus('No LEGO.JAM on the dev server (original-files/ or LEGO_JAM_PATH)')
    return
  }
  archive = openJamArchive(new Uint8Array(await response.arrayBuffer()))
  items = getBuilderItems(getChampionChassis(archive))
  const [loadedProgress, loadedParts, loadedColors] = await Promise.all([
    fetchJson<BuilderProgress>(`${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/${BUILDER_PROGRESS_FILE}`, {
      done: [],
    }),
    fetchJson<readonly LibraryPart[]>(
      `${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/${BUILDER_PARTS_FILE}`,
      []
    ),
    loadColors(),
  ])
  progress = loadedProgress
  libraryParts = loadedParts
  colors = loadedColors
  panel.showLibrary(libraryParts)
  panel.showColors(colors)
  panel.showReferenceMode(referenceMode)
  showTool()
  const requested = decodeURIComponent(location.hash.replace(/^#/, ''))
  const first =
    items.find((item) => item.id === requested) ??
    items.find((item) => !progress.done.includes(item.id)) ??
    items[0]
  if (first !== undefined) await openItem(first, null)
}

draw()
void run()
