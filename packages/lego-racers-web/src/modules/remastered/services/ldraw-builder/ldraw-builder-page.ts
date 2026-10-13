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
  Matrix4,
  Mesh,
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
import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { getBuildFrameMatrix } from '../ldraw-powerup/powerup-object-frame.ts'
import { setScaleMeta } from '../ldraw-scale-meta/ldraw-scale-meta.ts'
import { POWER_UP_SPRITES } from '../ldraw-powerup/powerup-sprites.ts'
import { createStudioLights, useLookFromAddress } from '@lego-games/ldraw/material'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import {
  DEVELOPMENT_LDRAW_MODELS_ROUTE,
  LDRAW_MODEL_FILES_FILE,
} from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelFile } from '../ldraw-models/ldraw-model-index.types.ts'
import { parseBuildableColorNames } from '../reference-kit/ldraw-color-names.ts'
import type { LDrawColorName } from '../reference-kit/reference-kit.types.ts'
import {
  addParts,
  applyConnectionSnap,
  createBuilderHistory,
  createPartShapes,
  findSideStud,
  getFacingRotation,
  getGridPoint,
  getGroundPhase,
  getPartBottom,
  getPartPhase,
  getPlacedStuds,
  getPlacementPosition,
  getRotatedBox,
  getSameColorIndices,
  getSideStudPosition,
  getTopGridPoint,
  pickParts,
  pushBuilderHistory,
  recolorParts,
  redoBuilderHistory,
  removeParts,
  serializeBuilderDocument,
  STUD_WIDTH,
  toggleIndex,
  turnAbout,
  turnQuarter,
  undoBuilderHistory,
} from '@lego-games/ldraw/building'
import { getBuilderItems, getNextBuilderItem, getStartFiles } from './builder-items.ts'
import {
  BUILDER_FIELD_OF_VIEW,
  BUILDER_VIEW_DIRECTION,
  createBuilderView,
  getBuilderViewPosition,
  getFramingView,
  orbitBuilderView,
  panBuilderView,
  scaleBuilderView,
  zoomBuilderView,
} from './builder-camera.ts'
import { createBuilderPanel } from './builder-panel.ts'
import { clearDraft, getStoredDraft, storeDraft } from './builder-draft.ts'
import { getBuilderKeyCommand, QUICK_COLOR_CODES } from './builder-shortcuts.ts'
import { BuilderAction } from './builder-shortcuts.types.ts'
import { createBuilderThumbnails } from './builder-thumbnails.ts'
import { ReferenceMode } from './builder-panel.types.ts'
import { createGhostInstance, createPartInstance, createPartTemplates } from './builder-parts.ts'
import {
  applySelectionEdit,
  getCameraStudStep as getViewStudStep,
  getSelectionEdit,
} from './builder-snapping.ts'
import type { SnapContext } from './builder-snapping.types.ts'
import {
  createConnectionLists,
  findSnap,
  getDragMode,
  startDrag,
  updateDrag,
} from './builder-drag.ts'
import type { DragModifiers, DragState, DragView, EditRay } from './builder-drag.types.ts'
import { createDragGuides } from './builder-drag-guides.ts'
import {
  createOriginalReference,
  createWheelGuides,
  getChampionChassis,
  loadBuilderItemStart,
} from './builder-reference.ts'
import { ReferenceShape } from './builder-reference.types.ts'
import type { BuilderItemStart, OriginalReference } from './builder-reference.types.ts'
import { getEmptyBuildArea, getPowerUpGridStuds } from './builder-reference-shape.ts'
import { createGhostOverlayMaterial } from './builder-ghost.ts'
import type { PartShape, PartStud } from '@lego-games/ldraw/building'
import {
  BUILDER_PARTS_FILE,
  BUILDER_PROGRESS_FILE,
  BUILDER_REMOVE_PATH,
  BUILDER_SAVE_PATH,
  DEVELOPMENT_LDRAW_BUILDER_ROUTE,
} from './ldraw-builder-route.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type {
  BuilderBox,
  BuilderItem,
  BuilderPart,
  BuilderPartLine,
  BuilderProgress,
  BuilderRemoveRequest,
  BuilderRemoveResult,
  BuilderSaveRequest,
  BuilderSaveResult,
  LibraryPart,
  Vector,
} from './ldraw-builder.types.ts'
import { PointerGesture } from './ldraw-builder-page.types.ts'
import type {
  BuilderTool,
  PointerHit,
  PointerPosition,
  PointerPress,
} from './ldraw-builder-page.types.ts'
import { setUpLDrawModelParser } from '../ldraw-worker/ldraw-model-parser.ts'
import { readDevelopmentLibraryFile } from '../ldraw-library/ldraw-library-reader.ts'

const BACKGROUND_COLOR = 0x2b3340
const SELECTION_COLOR = 0xffd400
const GRID_COLOR = 0x5a6578
const GHOST_REFERENCE_OPACITY = 0.45
const CLICK_DISTANCE = 5
const CAR_GRID_STUDS = 40
// The empty ground a model starts on: the editing frame's floor (a chassis's brick bottom, a car's origin).
const GROUND_HEIGHT = 0
const LINE_PIXELS = 16
const IDENTITY_ROTATION: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const DEFAULT_TOOL: BuilderTool = {
  partName: '3001.dat',
  colorCode: 4,
  rotation: IDENTITY_ROTATION,
}
const REFERENCE_MODES: readonly ReferenceMode[] = Object.values(ReferenceMode)
const SCALE_STEP = 1.1
const SCALE_DECIMALS = 3
const MINIMUM_SCALE = 0.05
const MAXIMUM_SCALE = 20
const SCALED_KINDS: readonly BuilderItemKind[] = [
  BuilderItemKind.POWER_UP,
  BuilderItemKind.PARTICLE,
]

useLookFromAddress()
setUpLDrawModelParser()

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

const camera = new PerspectiveCamera(BUILDER_FIELD_OF_VIEW, 1, 0.05, 1000)
camera.up.set(0, 0, 1)
let view = createBuilderView([0, 0, 0], BUILDER_VIEW_DIRECTION, 10)

const buildScene = new Scene()
const ldrawFrame = new Group()
ldrawFrame.matrixAutoUpdate = false
ldrawFrame.matrix.copy(getBuildFrameMatrix(1))
const editFrame = new Group()
const partsGroup = new Group()
const createGrid = (studs: number): GridHelper => {
  const created = new GridHelper(studs * STUD_WIDTH, studs, GRID_COLOR, GRID_COLOR)
  created.raycast = () => undefined
  return created
}
let grid = createGrid(CAR_GRID_STUDS)
editFrame.add(partsGroup, grid)
ldrawFrame.add(editFrame)
const guidesHolder = new Group()
const selectionHolder = new Group()
buildScene.add(createStudioLights(), ldrawFrame, guidesHolder, selectionHolder)
const referenceScene = new Scene()

const overlayTarget = new WebGLRenderTarget(1, 1)
const overlayScene = new Scene()
const overlayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
overlayScene.add(
  new Mesh(
    new PlaneGeometry(2, 2),
    createGhostOverlayMaterial(overlayTarget.texture, GHOST_REFERENCE_OPACITY)
  )
)

const panel = createBuilderPanel(
  {
    queue: findElement('queue'),
    bar: findElement('bar'),
    palette: findElement('palette'),
    help: findElement('help'),
    shortcuts: findElement('shortcuts'),
    status: findElement('status'),
  },
  {
    onItemSelect: (itemId) => void selectItem(itemId),
    onStartFileSelect: (file) => void restartItem(file),
    onReferenceModeSelect: (mode) => setReferenceMode(mode),
    onPartSelect: (partName) => takeInHand(partName),
    onColorSelect: (colorCode) => chooseColor(colorCode),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onRotate: () => rotate(false),
    onDeleteSelected: () => deleteSelected(),
    onDone: () => void finishItem(),
    onRemove: () => void removeItem(),
    onScaleStep: (direction) => stepScale(direction),
    onScaleFit: () => fitScale(),
    onShortcutsToggle: () => toggleShortcuts(),
    getThumbnail: (partName, colorCode, getIsWanted) =>
      thumbnails.getThumbnail(partName, colorCode, getIsWanted),
  }
)

const templates = createPartTemplates()
const partShapes = createPartShapes(readDevelopmentLibraryFile)
const thumbnails = createBuilderThumbnails()
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
let isHolding = false
let selectedIndices: readonly number[] = Object.freeze([])
let clipboard: readonly BuilderPart[] = Object.freeze([])
// The model while a drag moves the selection, committed once on release.
let draftParts: readonly BuilderPart[] | null = null
let referenceMode: ReferenceMode = ReferenceMode.SIDE
let reference: OriginalReference | null = null
let ghost: Group | null = null
let ghostKey = ''
let ghostPosition: Vector | null = null
// The part in hand's turn where the ghost is: its own, or turned so its bottom faces a side stud.
let ghostRotation: readonly number[] = IDENTITY_ROTATION
let pointer: PointerPosition | null = null
let isSyncScheduled = false
let isSaving = false
// The factor a power-up object's or a particle's file is drawn at (powerup-object-frame.ts), and the one it was opened with.
let scale = 1
let savedScale = 1

const getIsScaled = (): boolean => currentItem !== null && SCALED_KINDS.includes(currentItem.kind)

const getIsDirty = () => history.present !== savedParts || scale !== savedScale

const getTemplateBox = (part: BuilderPart): BuilderBox | null =>
  templates.getLoaded(part.partName, part.colorCode)?.box ?? null

const getDescription = (partName: string) =>
  libraryParts.find((part) => part.name.toLowerCase() === partName.toLowerCase())?.description ?? ''

const getPartName = (partName: string) => partName.replace(/\.dat$/i, '')

const getSelectionText = (parts: readonly BuilderPart[]): string => {
  const [first] = selectedIndices
  const selected = first === undefined ? undefined : parts[first]
  if (selected === undefined) return ''
  return selectedIndices.length > 1
    ? `${String(selectedIndices.length)} selected`
    : `selected ${selected.partName} (${String(selected.colorCode)}) at ${selected.position.join(' ')}`
}

const showStatus = () => {
  const parts = history.present
  const missing = parts.filter(
    (part) => templates.getLoaded(part.partName, part.colorCode) === null
  )
  panel.showStatus(
    [
      start?.file ?? '',
      `${String(parts.length)} parts`,
      missing.length > 0
        ? `${String(missing.length)} not in the library (${[...new Set(missing.map((part) => part.partName))].join(', ')})`
        : '',
      getSelectionText(parts),
      getIsDirty() ? 'unsaved changes' : 'saved',
    ]
      .filter((text) => text !== '')
      .join(' · ')
  )
}

const ITEM_HINTS: Readonly<Record<BuilderItemKind, string>> = Object.freeze({
  [BuilderItemKind.CHASSIS]: 'wheels go on the guides (W)',
  [BuilderItemKind.CAR]:
    'the whole car (chassis and body) but the wheels: the game draws those, spinning and steering, on the guides (W)',
  [BuilderItemKind.DRIVER]:
    'the standing figure, origin the top of the hips: each part follows the bone of its 0 !RACERS ROLE line; a plain head or torso shows the game picture',
  [BuilderItemKind.POWER_UP]:
    'the power-up object as the original models it (front along x): the race draws it at this size and place (⌥= ⌥- scale, ⌥0 fits the original) and spins, moves and fades it as the game does',
  [BuilderItemKind.PARTICLE]:
    "one piece of the particle, studs up (they face the camera; LDraw z up the quad): the race draws it at this size in a car's studs (⌥= ⌥- scale, ⌥0 real size), shrunk to a smaller quad, several spread over a bigger one",
})

const EFFECT_NOTE =
  'this effect is a flat/animated sprite in the original (its mesh is only a guide); build freely'
const NO_REFERENCE_NOTE =
  'the original draws no mesh for this effect (a flat/animated sprite); build freely on the grid'

const SPRITE_NOTE =
  "the original draws a camera-facing sprite (the card, in car studs): the race draws the file at the sprite's centre, studs to the camera"

const getReferenceNote = (): string => {
  if (currentItem?.kind !== BuilderItemKind.POWER_UP) return ''
  if (POWER_UP_SPRITES[currentItem.name] !== undefined) return SPRITE_NOTE
  if (reference === null || reference.shape === ReferenceShape.NONE) return NO_REFERENCE_NOTE
  return reference.shape === ReferenceShape.EFFECT ? EFFECT_NOTE : ''
}

const getHint = (): string =>
  [getActionHint(), currentItem === null ? '' : ITEM_HINTS[currentItem.kind], getReferenceNote()]
    .filter((text) => text !== '')
    .join(' · ')

const getActionHint = (): string => {
  if (isHolding) {
    return `Click to place ${getPartName(tool.partName)} ${getDescription(tool.partName)} · R rotate · T tilt · snaps to studs and joints · ⎋ put down`
  }
  if (selectedIndices.length > 0) {
    return 'Drag to move (snaps to studs and joints) · ⇧ drag straight · ⌘ drag up, down · arrows a stud · ⌘↑↓ a plate · ⌥ arrows nudge · R rotate · ⌫ delete · ⎋ deselect'
  }
  return 'Pick a part on the right to build · click a part to select it · ⇧ click adds'
}

const showTool = () => {
  panel.showTool({
    partName: tool.partName,
    description: getDescription(tool.partName),
    colorCode: tool.colorCode,
    colorName: colors.find((color) => color.code === tool.colorCode)?.name ?? '',
    isHolding,
  })
  panel.showHint(getHint())
}

const scheduleSync = () => {
  if (isSyncScheduled) return
  isSyncScheduled = true
  requestAnimationFrame(() => {
    isSyncScheduled = false
    syncScene()
  })
}

// Puts a copy of each part's template where the part is; a template that has not arrived yet is asked for and the scene follows.
const fillGroup = (group: Group, parts: readonly BuilderPart[]) => {
  group.clear()
  parts.forEach((part, index) => {
    const template = templates.getLoaded(part.partName, part.colorCode)
    if (template === undefined) {
      void templates.load(part.partName, part.colorCode).then(scheduleSync)
      return
    }
    if (template === null) return
    const instance = createPartInstance(template, part)
    instance.userData = { partIndex: index }
    group.add(instance)
  })
}

const syncSelection = () => {
  selectionHolder.clear()
  buildScene.updateMatrixWorld(true)
  for (const instance of partsGroup.children) {
    const partIndex: unknown = instance.userData['partIndex']
    if (typeof partIndex === 'number' && selectedIndices.includes(partIndex)) {
      selectionHolder.add(new Box3Helper(new Box3().setFromObject(instance), SELECTION_COLOR))
    }
  }
}

const keepDraft = () => {
  if (currentItem === null) return
  if (getIsDirty()) storeDraft(currentItem.id, history.present)
  else clearDraft(currentItem.id)
}

const syncScene = () => {
  keepDraft()
  fillGroup(partsGroup, draftParts ?? history.present)
  panel.showUsedParts(history.present.map((part) => part.partName))
  syncSelection()
  syncGhost()
  showStatus()
  panel.showHint(getHint())
}

const getOwner = (object: Object3D | null): Object3D | null => {
  let current = object
  while (current !== null && !('partIndex' in current.userData)) {
    current = current.parent
  }
  return current
}

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

// The side stud of a part (in the editing frame) under the cursor; its studs are read from the library the first time.
// A part's shape (studs, footprint, bottom), read from the library the first time (none until it arrives; the scene follows).
const getShape = (partName: string): PartShape | undefined => {
  const shape = partShapes.getLoaded(partName)
  if (shape === undefined) void partShapes.load(partName).then(scheduleSync)
  return shape
}

const getStuds = (partName: string): readonly PartStud[] => getShape(partName)?.studs ?? []

const NO_SHAPE: PartShape = Object.freeze({
  studs: [],
  holes: [],
  box: null,
  footprint: null,
  bottom: null,
  description: '',
})

const snapContext: SnapContext = {
  getShape,
  getBox: getTemplateBox,
  groundHeight: GROUND_HEIGHT,
}

const getConnections = createConnectionLists(getShape)
// The connection a drag joins and its guide line; the connection the part in hand joins.
const dragGuides = createDragGuides()
const ghostGuides = createDragGuides()
editFrame.add(dragGuides.object, ghostGuides.object)
let drag: DragState | null = null

const getSideStudUnder = (part: BuilderPart, point: Vector, normal: Vector): PartStud | null =>
  findSideStud(getPlacedStuds(getStuds(part.partName), part), point, normal)

// The face under the cursor in the editing frame, with the grid of the part it belongs to; the ground when there is none.
const getPointerHit = (position: PointerPosition): PointerHit | null => {
  const raycaster = getRay(position)
  if (raycaster === null) return null
  buildScene.updateMatrixWorld(true)
  const toEdit = editFrame.matrixWorld.clone().invert()
  const hit = raycaster
    .intersectObjects([partsGroup], true)
    .find((intersection) => intersection.object instanceof Mesh && intersection.face != null)
  const owner = getOwner(hit?.object ?? null)
  if (hit !== undefined && hit.face != null && owner !== null) {
    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
    if (worldNormal.dot(raycaster.ray.direction) > 0) worldNormal.negate()
    const normal = worldNormal.transformDirection(toEdit)
    const partIndex: unknown = owner.userData['partIndex']
    const part = typeof partIndex === 'number' ? history.present[partIndex] : undefined
    const box = part === undefined ? null : getTemplateBox(part)
    if (typeof partIndex === 'number' && part !== undefined && box !== null) {
      const point = toEditFrame(hit.point)
      const hitNormal: Vector = [normal.x, normal.y, normal.z]
      return {
        target: {
          point,
          normal: hitNormal,
          phase: getPartPhase(getTopGridPoint(getStuds(part.partName), box, part, point), part),
        },
        partIndex,
        part,
        sideStud: getSideStudUnder(part, point, hitNormal),
      }
    }
  }
  const ray = raycaster.ray.clone().applyMatrix4(toEdit)
  const ground = ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -GROUND_HEIGHT), new Vector3())
  return ground === null
    ? null
    : {
        target: {
          point: [ground.x, ground.y, ground.z],
          normal: [0, -1, 0],
          phase: getGroundPhase(GROUND_HEIGHT),
        },
        partIndex: null,
        part: null,
        sideStud: null,
      }
}

const removeGhost = () => {
  if (ghost !== null) editFrame.remove(ghost)
  ghost = null
  ghostKey = ''
}

const syncGhost = () => {
  const template = isHolding ? templates.getLoaded(tool.partName, tool.colorCode) : null
  if (template === undefined) void templates.load(tool.partName, tool.colorCode).then(scheduleSync)
  const hit = pointer === null || template == null ? null : getPointerHit(pointer)
  if (template == null || hit === null) {
    removeGhost()
    ghostPosition = null
    ghostGuides.show(null, null)
    return
  }
  const stud = hit.sideStud
  ghostRotation = stud === null ? tool.rotation : getFacingRotation(tool.rotation, stud.direction)
  const box = getRotatedBox(template.box, ghostRotation)
  const shape = getShape(tool.partName) ?? NO_SHAPE
  const gridPoint = getGridPoint(shape, template.box, ghostRotation)
  ghostPosition =
    stud === null
      ? getPlacementPosition(
          hit.target,
          box,
          gridPoint,
          getPartBottom(shape, template.box, ghostRotation)
        )
      : getSideStudPosition(hit.target.point, stud, box, gridPoint)
  const snapped = snapGhost({ ...tool, rotation: ghostRotation, position: ghostPosition })
  ghostPosition = snapped.position
  ghostRotation = snapped.rotation
  const part = { ...tool, rotation: ghostRotation, position: ghostPosition }
  const key = `${tool.partName}|${String(tool.colorCode)}`
  if (ghost === null || key !== ghostKey) {
    removeGhost()
    ghost = createGhostInstance(template, part)
    ghostKey = key
    editFrame.add(ghost)
  }
  ghost.matrix.copy(createPartInstance(template, part).matrix)
}

// The part in hand pulled onto the nearest connection near it (a head onto a neck, a hat onto a head), its target marked.
const snapGhost = (part: BuilderPartLine): BuilderPartLine => {
  const parts = [...history.present, { ...part, commentLines: [] }]
  const index = parts.length - 1
  const snap = findSnap(parts, [index], dragView, pointer, () => true)
  ghostGuides.show(snap?.target ?? null, null)
  return snap === null ? part : (applyConnectionSnap(parts, [index], snap)[index] ?? part)
}

const commit = (parts: readonly BuilderPart[]) => {
  history = pushBuilderHistory(history, Object.freeze(parts))
  syncScene()
}

const placePart = () => {
  if (ghostPosition === null) return
  const position = ghostPosition
  commit([
    ...history.present,
    Object.freeze({ ...tool, rotation: ghostRotation, position, commentLines: [] }),
  ])
}

const setTool = (next: BuilderTool, isNextHolding: boolean) => {
  tool = next
  isHolding = isNextHolding
  showTool()
  syncGhost()
}

const setSelectedIndices = (indices: readonly number[]) => {
  selectedIndices = Object.freeze([...indices])
  syncSelection()
  showStatus()
  panel.showHint(getHint())
}

const takeInHand = (partName: string) => {
  setSelectedIndices([])
  setTool({ ...tool, partName }, true)
}

const putDown = () => {
  if (panel.getIsShortcutsShown()) panel.setIsShortcutsShown(false)
  else if (isHolding) setTool(tool, false)
  else setSelectedIndices([])
}

const chooseColor = (colorCode: number) => {
  setTool({ ...tool, colorCode }, isHolding)
  const recolored = recolorParts(history.present, selectedIndices, colorCode)
  if (recolored !== history.present) commit(recolored)
}

// The colour under the cursor, else the first selected part's: every part of it is selected.
const selectPointedColor = () => {
  const pointed = pointer === null ? null : (getPointerHit(pointer)?.part ?? null)
  const colorCode = (pointed ?? history.present[selectedIndices[0] ?? -1])?.colorCode
  if (colorCode === undefined) return
  setTool(tool, false)
  setSelectedIndices(getSameColorIndices(history.present, colorCode))
}

const rotate = (isBack: boolean) =>
  isHolding || selectedIndices.length === 0
    ? setTool(
        {
          ...tool,
          rotation: isBack
            ? turnQuarter(turnQuarter(turnQuarter(tool.rotation)))
            : turnQuarter(tool.rotation),
        },
        isHolding
      )
    : editSelected(isBack ? BuilderAction.ROTATE_BACK : BuilderAction.ROTATE)

// T tilts about the level axis across the view (the camera's right, on the nearest LDraw axis).
const tilt = (isBack: boolean) => {
  const step = getCameraStudStep(false, isBack ? -1 : 1)
  const axis: Vector = [Math.sign(step[0]), 0, Math.sign(step[2])]
  if (isHolding || selectedIndices.length === 0) {
    setTool({ ...tool, rotation: turnAbout(tool.rotation, axis) }, isHolding)
  } else editSelected(isBack ? BuilderAction.TILT_BACK : BuilderAction.TILT)
}

const deleteSelected = () => {
  if (selectedIndices.length === 0) return
  const removed = selectedIndices
  selectedIndices = Object.freeze([])
  commit(removeParts(history.present, removed))
}

// A key's edit of the selection, snapped to the stud grid of what is under it (a fine nudge excepted).
const editSelected = (action: BuilderAction) => {
  const edit = getSelectionEdit(action, view)
  if (edit === null || selectedIndices.length === 0) return
  const edited = applySelectionEdit(history.present, selectedIndices, edit, snapContext)
  if (edited !== history.present) commit(edited)
}

// The camera's right or forward, along the nearest of the editing frame's ground axes.
const getCameraStudStep = (isForward: boolean, sign: number): Vector =>
  getViewStudStep(view, isForward, sign)

const addCopies = (copies: readonly BuilderPart[]) => {
  if (copies.length === 0) return
  const added = addParts(history.present, copies, getCameraStudStep(false, 1))
  selectedIndices = added.indices
  isHolding = false
  showTool()
  commit(added.parts)
}

const copySelected = () => {
  clipboard = pickParts(history.present, selectedIndices)
}

const selectAll = () => {
  setTool(tool, false)
  setSelectedIndices(history.present.map((_part, index) => index))
}

const undo = () => {
  history = undoBuilderHistory(history)
  selectedIndices = Object.freeze([])
  syncScene()
}

const redo = () => {
  history = redoBuilderHistory(history)
  selectedIndices = Object.freeze([])
  syncScene()
}

const takeFromPointer = (isWholePart: boolean) => {
  const part = pointer === null ? null : (getPointerHit(pointer)?.part ?? null)
  if (part === null) return
  if (isWholePart) {
    setSelectedIndices([])
    setTool({ partName: part.partName, colorCode: part.colorCode, rotation: part.rotation }, true)
  } else {
    setTool({ ...tool, colorCode: part.colorCode }, isHolding)
  }
}

const setReferenceMode = (mode: ReferenceMode) => {
  referenceMode = mode
  panel.showReferenceMode(mode)
}

const cycleReferenceMode = () =>
  setReferenceMode(
    REFERENCE_MODES[(REFERENCE_MODES.indexOf(referenceMode) + 1) % REFERENCE_MODES.length] ??
      ReferenceMode.SIDE
  )

// Frames what is shown (the parts and the original's bounds) in the build view's own viewport, half the canvas side by side.
const frameCamera = () => {
  buildScene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(partsGroup)
  if (reference !== null && reference.shape !== ReferenceShape.NONE) box.union(reference.bounds)
  if (box.isEmpty()) box.copy(getEmptyBuildArea(getIsScaled()))
  view = getFramingView(
    [box.min.x, box.min.y, box.min.z],
    [box.max.x, box.max.y, box.max.z],
    BUILDER_VIEW_DIRECTION,
    getViewWidth() / Math.max(canvas.clientHeight, 1),
    BUILDER_FIELD_OF_VIEW
  )
}

// A car's wide stud grid; a power-up object's or a particle's sized to its original's footprint (in the build's studs, which the
// scale shrinks or grows).
const replaceGrid = () => {
  editFrame.remove(grid)
  grid.dispose()
  const shownBounds = reference?.bounds.clone() ?? null
  grid = createGrid(
    getIsScaled()
      ? getPowerUpGridStuds(
          shownBounds?.applyMatrix4(new Matrix4().makeScale(1 / scale, 1 / scale, 1)) ?? null
        )
      : CAR_GRID_STUDS
  )
  editFrame.add(grid)
}

const FIT_LABELS: Readonly<Record<BuilderItemKind, string>> = Object.freeze({
  [BuilderItemKind.CHASSIS]: '',
  [BuilderItemKind.CAR]: '',
  [BuilderItemKind.DRIVER]: '',
  [BuilderItemKind.POWER_UP]: 'Fit',
  [BuilderItemKind.PARTICLE]: 'Real size',
})

// The build drawn at the scale (1 for an item without one), the grid with it, the control showing it.
const applyScale = () => {
  ldrawFrame.matrix.copy(getBuildFrameMatrix(getIsScaled() ? scale : 1))
  replaceGrid()
  panel.showScale({
    isShown: getIsScaled(),
    factor: scale,
    fitLabel: currentItem === null ? '' : FIT_LABELS[currentItem.kind],
  })
  scheduleSync()
}

const setScale = (next: number) => {
  scale = Number(Math.min(MAXIMUM_SCALE, Math.max(MINIMUM_SCALE, next)).toFixed(SCALE_DECIMALS))
  applyScale()
}

// The parts' bounds in the file's own frame (LDraw units and axes).
const getFileBounds = (): Box3 => {
  buildScene.updateMatrixWorld(true)
  return new Box3().setFromObject(partsGroup).applyMatrix4(editFrame.matrixWorld.clone().invert())
}

// A power-up object's fit to its original, a particle's real size.
const getFittedScale = (): number => {
  const bounds = getFileBounds()
  return reference === null || bounds.isEmpty() ? 1 : reference.getFittedScale(bounds)
}

const stepScale = (direction: number) => {
  if (getIsScaled()) setScale(direction > 0 ? scale * SCALE_STEP : scale / SCALE_STEP)
}

const fitScale = () => {
  if (getIsScaled()) setScale(getFittedScale())
}

const applyView = () => {
  camera.position.set(...getBuilderViewPosition(view))
  camera.lookAt(...view.target)
  camera.near = view.distance / 100
  camera.far = view.distance * 20
}

const getUnitsPerPixel = () =>
  (2 * view.distance * Math.tan((BUILDER_FIELD_OF_VIEW * Math.PI) / 360)) /
  Math.max(canvas.clientHeight, 1)

const toggleShortcuts = () => panel.setIsShortcutsShown(!panel.getIsShortcutsShown())

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
  panel.showStartFiles(
    getStartFiles(
      item,
      files.map((file) => file.path)
    ),
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
  const storedDraft = startFile === null ? getStoredDraft(item.id) : null
  history = createBuilderHistory(start.document.parts)
  savedParts = history.present
  if (storedDraft !== null) history = createBuilderHistory(storedDraft.parts)
  selectedIndices = Object.freeze([])
  draftParts = null
  editFrame.position.set(...start.editOffset)
  editFrame.updateMatrix()
  reference?.dispose()
  reference = createOriginalReference(archive, item)
  referenceScene.clear()
  if (reference !== null) referenceScene.add(reference.object)
  scale = 1
  applyScale()
  guidesHolder.clear()
  if (item.chassisName !== '') guidesHolder.add(createWheelGuides(archive, item.chassisName))
  guidesHolder.visible = true
  await Promise.all(history.present.map((part) => templates.load(part.partName, part.colorCode)))
  syncScene()
  setScale(start.scale ?? (getIsScaled() ? getFittedScale() : 1))
  savedScale = scale
  syncScene()
  frameCamera()
  replaceAddressHash(item.id)
  panel.showRemove({ isShown: start.isFilePresent, file: start.file })
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
    body: JSON.stringify({ itemId, text } satisfies BuilderSaveRequest),
  })
  return response.ok ? ((await response.json()) as BuilderSaveResult) : response.text()
}

// Done: the model goes into the models folder (the old file to a backup first), the item is marked done, and the next one opens.
const finishItem = async () => {
  if (currentItem === null || start === null || isSaving) return
  isSaving = true
  panel.setIsBusy(true)
  try {
    const text = serializeBuilderDocument(
      setScaleMeta({ ...start.document, parts: history.present }, getIsScaled() ? scale : null)
    )
    const result = await postModel(currentItem.id, text)
    if (typeof result === 'string') {
      panel.showStatus(`Not saved: ${result}`)
      return
    }
    savedParts = history.present
    savedScale = scale
    clearDraft(currentItem.id)
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

const postRemoval = async (itemId: string): Promise<BuilderRemoveResult | string> => {
  const response = await fetch(`${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/${BUILDER_REMOVE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId } satisfies BuilderRemoveRequest),
  })
  return response.ok ? ((await response.json()) as BuilderRemoveResult) : response.text()
}

// Remove model: the item's file goes into the backups (Start from offers it back), its mark and draft go, and the game falls back.
const removeItem = async () => {
  if (currentItem === null || isSaving) return
  isSaving = true
  panel.setIsBusy(true)
  try {
    const result = await postRemoval(currentItem.id)
    if (typeof result === 'string') {
      panel.showStatus(`Not removed: ${result}`)
      return
    }
    clearDraft(currentItem.id)
    progress = result.progress
    savedParts = history.present
    savedScale = scale
    await openItem(currentItem, null)
    panel.showStatus(`Removed ${result.path} · moved to ${result.backupPath}`)
  } finally {
    isSaving = false
    panel.setIsBusy(false)
  }
}

const getIsTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement

const getKeyActions = (quickColorIndex: number): Readonly<Record<BuilderAction, () => void>> => ({
  [BuilderAction.ROTATE]: () => rotate(false),
  [BuilderAction.ROTATE_BACK]: () => rotate(true),
  [BuilderAction.TILT]: () => tilt(false),
  [BuilderAction.TILT_BACK]: () => tilt(true),
  [BuilderAction.MOVE_LEFT]: () => editSelected(BuilderAction.MOVE_LEFT),
  [BuilderAction.MOVE_RIGHT]: () => editSelected(BuilderAction.MOVE_RIGHT),
  [BuilderAction.MOVE_AWAY]: () => editSelected(BuilderAction.MOVE_AWAY),
  [BuilderAction.MOVE_TOWARD]: () => editSelected(BuilderAction.MOVE_TOWARD),
  [BuilderAction.RAISE_PLATE]: () => editSelected(BuilderAction.RAISE_PLATE),
  [BuilderAction.LOWER_PLATE]: () => editSelected(BuilderAction.LOWER_PLATE),
  [BuilderAction.RAISE_BRICK]: () => editSelected(BuilderAction.RAISE_BRICK),
  [BuilderAction.LOWER_BRICK]: () => editSelected(BuilderAction.LOWER_BRICK),
  [BuilderAction.NUDGE_LEFT]: () => editSelected(BuilderAction.NUDGE_LEFT),
  [BuilderAction.NUDGE_RIGHT]: () => editSelected(BuilderAction.NUDGE_RIGHT),
  [BuilderAction.NUDGE_AWAY]: () => editSelected(BuilderAction.NUDGE_AWAY),
  [BuilderAction.NUDGE_TOWARD]: () => editSelected(BuilderAction.NUDGE_TOWARD),
  [BuilderAction.NUDGE_UP]: () => editSelected(BuilderAction.NUDGE_UP),
  [BuilderAction.NUDGE_DOWN]: () => editSelected(BuilderAction.NUDGE_DOWN),
  [BuilderAction.DELETE]: deleteSelected,
  [BuilderAction.COPY]: copySelected,
  [BuilderAction.PASTE]: () => addCopies(clipboard),
  [BuilderAction.DUPLICATE]: () => addCopies(pickParts(history.present, selectedIndices)),
  [BuilderAction.UNDO]: undo,
  [BuilderAction.REDO]: redo,
  [BuilderAction.SELECT_ALL]: selectAll,
  [BuilderAction.SELECT_COLOR]: selectPointedColor,
  [BuilderAction.SAVE]: () => void finishItem(),
  [BuilderAction.TAKE_COLOR]: () => takeFromPointer(false),
  [BuilderAction.TAKE_PART]: () => takeFromPointer(true),
  [BuilderAction.QUICK_COLOR]: () => {
    const colorCode = QUICK_COLOR_CODES[quickColorIndex]
    if (colorCode !== undefined) chooseColor(colorCode)
  },
  [BuilderAction.CANCEL]: putDown,
  [BuilderAction.FRAME]: frameCamera,
  [BuilderAction.REFERENCE]: cycleReferenceMode,
  [BuilderAction.WHEEL_GUIDES]: () => void (guidesHolder.visible = !guidesHolder.visible),
  [BuilderAction.SHORTCUTS]: toggleShortcuts,
  [BuilderAction.SCALE_UP]: () => stepScale(1),
  [BuilderAction.SCALE_DOWN]: () => stepScale(-1),
  [BuilderAction.SCALE_FIT]: fitScale,
})

const onKeyDown = (event: KeyboardEvent) => {
  if (getIsTyping(event.target)) return
  const command = getBuilderKeyCommand({
    key: event.key,
    isCommand: event.metaKey || event.ctrlKey,
    isShift: event.shiftKey,
    isOption: event.altKey,
  })
  if (command === null) return
  event.preventDefault()
  getKeyActions(command.quickColorIndex)[command.action]()
}

let press: PointerPress | null = null

const getGroundPoint = (position: PointerPosition, height: number): Vector | null => {
  const raycaster = getRay(position)
  if (raycaster === null) return null
  buildScene.updateMatrixWorld(true)
  const ray = raycaster.ray.clone().applyMatrix4(editFrame.matrixWorld.clone().invert())
  const point = ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), new Vector3())
  return point === null ? null : [point.x, point.y, point.z]
}

const getPressGesture = (event: PointerEvent, hit: PointerHit | null): PointerGesture => {
  if (event.altKey) return event.shiftKey ? PointerGesture.PAN : PointerGesture.ORBIT
  if (isHolding) return PointerGesture.PLACE
  return hit?.partIndex == null ? PointerGesture.SELECT : PointerGesture.MOVE
}

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  canvas.setPointerCapture(event.pointerId)
  const position = { clientX: event.clientX, clientY: event.clientY }
  const hit = isHolding || event.altKey ? null : getPointerHit(position)
  const partIndex = hit?.partIndex ?? null
  const gesture = getPressGesture(event, hit)
  const isAlreadySelected = partIndex !== null && selectedIndices.includes(partIndex)
  if (gesture === PointerGesture.MOVE && partIndex !== null && !isAlreadySelected) {
    setSelectedIndices(event.shiftKey ? [...selectedIndices, partIndex] : [partIndex])
  }
  press = Object.freeze({
    start: position,
    last: position,
    gesture,
    partIndex,
    isAlreadySelected,
    isShift: event.shiftKey,
    groundStart:
      gesture === PointerGesture.MOVE && hit !== null
        ? getGroundPoint(position, hit.target.point[1])
        : null,
    isDragging: false,
  })
}

const getEditRay = (position: PointerPosition): EditRay | null => {
  const raycaster = getRay(position)
  if (raycaster === null) return null
  buildScene.updateMatrixWorld(true)
  const ray = raycaster.ray.clone().applyMatrix4(editFrame.matrixWorld.clone().invert())
  return { origin: [...ray.origin.toArray()], direction: [...ray.direction.toArray()] }
}

const projectToScreen = (point: Vector): readonly [number, number] => {
  const projected = editFrame.localToWorld(new Vector3(...point)).project(camera)
  return [((projected.x + 1) / 2) * getViewWidth(), ((1 - projected.y) / 2) * canvas.clientHeight]
}

const dragView: DragView = {
  getGroundPoint,
  getRay: getEditRay,
  project: projectToScreen,
  toScreen: (position) => {
    const bounds = canvas.getBoundingClientRect()
    return [position.clientX - bounds.left, position.clientY - bounds.top]
  },
  getConnections,
  snapContext,
}

// A drag of the selection: onto the nearest connection, else along the stud grid; ⇧ holds it to one axis, ⌘ moves it up and down.
const dragSelection = (
  current: PointerPress,
  position: PointerPosition,
  modifiers: DragModifiers
) => {
  const grabbed = current.groundStart
  if (grabbed === null) return
  const state =
    drag ?? startDrag(history.present, grabbed, current.start, getDragMode(modifiers), dragView)
  const draft = updateDrag(state, selectedIndices, position, modifiers, dragView)
  drag = draft.state
  draftParts = draft.state.parts
  dragGuides.show(draft.target, draft.guide)
  syncScene()
}

const onPointerMove = (event: PointerEvent) => {
  const position = { clientX: event.clientX, clientY: event.clientY }
  pointer = position
  const current = press
  if (current === null) {
    syncGhost()
    return
  }
  const isDragging =
    current.isDragging ||
    Math.hypot(
      position.clientX - current.start.clientX,
      position.clientY - current.start.clientY
    ) >= CLICK_DISTANCE
  const deltaX = position.clientX - current.last.clientX
  const deltaY = position.clientY - current.last.clientY
  press = Object.freeze({ ...current, last: position, isDragging })
  if (!isDragging) return
  if (current.gesture === PointerGesture.ORBIT) view = orbitBuilderView(view, deltaX, deltaY)
  else if (current.gesture === PointerGesture.PAN) {
    view = panBuilderView(view, deltaX, deltaY, getUnitsPerPixel())
  } else if (current.gesture === PointerGesture.MOVE) {
    dragSelection(current, position, {
      isShift: event.shiftKey,
      isCommand: event.metaKey || event.ctrlKey,
    })
  } else syncGhost()
}

const onClick = (current: PointerPress) => {
  if (current.gesture === PointerGesture.ORBIT) takeFromPointer(false)
  else if (current.gesture === PointerGesture.PAN) selectPointedColor()
  else if (current.gesture === PointerGesture.PLACE) placePart()
  else if (current.partIndex === null) {
    if (!current.isShift) setSelectedIndices([])
  } else if (current.isShift) {
    if (current.isAlreadySelected)
      setSelectedIndices(toggleIndex(selectedIndices, current.partIndex))
  } else setSelectedIndices([current.partIndex])
}

const onPointerUp = (event: PointerEvent) => {
  const current = press
  press = null
  drag = null
  dragGuides.show(null, null)
  if (current === null || event.button !== 0) return
  if (!current.isDragging) {
    onClick(current)
    return
  }
  const moved = draftParts
  draftParts = null
  if (moved !== null && current.gesture === PointerGesture.MOVE) commit(moved)
}

const onPointerLeave = () => {
  pointer = null
  syncGhost()
}

// A trackpad: two fingers orbit, with Shift they pan; a pinch arrives as a wheel event with ctrlKey.
const onWheel = (event: WheelEvent) => {
  event.preventDefault()
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PIXELS : 1
  const deltaX = event.deltaX * scale
  const deltaY = event.deltaY * scale
  if (event.ctrlKey) view = zoomBuilderView(view, deltaY)
  else if (event.shiftKey) view = panBuilderView(view, deltaX, deltaY, getUnitsPerPixel())
  else view = orbitBuilderView(view, deltaX, deltaY)
}

// Safari reports a pinch as gesture events instead of a wheel with ctrlKey.
let gestureScale = 1
const onGesture = (event: Event) => {
  event.preventDefault()
  const scale: unknown = 'scale' in event ? event.scale : 1
  if (typeof scale !== 'number' || scale <= 0) return
  if (event.type === 'gesturestart') gestureScale = 1
  view = scaleBuilderView(view, gestureScale / scale)
  gestureScale = scale
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('beforeunload', (event) => {
  if (getIsDirty()) event.preventDefault()
})
canvas.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('pointerdown', onPointerDown)
canvas.addEventListener('pointerup', onPointerUp)
canvas.addEventListener('pointerleave', onPointerLeave)
canvas.addEventListener('wheel', onWheel, { passive: false })
canvas.addEventListener('contextmenu', (event) => event.preventDefault())
for (const type of ['gesturestart', 'gesturechange']) {
  canvas.addEventListener(type, onGesture, { passive: false })
}

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
  applyView()
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
  return response.ok ? parseBuildableColorNames(await response.text()) : []
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
