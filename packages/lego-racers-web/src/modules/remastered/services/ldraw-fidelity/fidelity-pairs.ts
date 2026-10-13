import {
  BRICK_DATABASE_PATH,
  createBuildGrid,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickPiece, CarDesign } from '@lego-games/lego-racers/car-builder'
import { parseChassisDatabase } from '@lego-games/lego-racers/chassis-database'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import {
  getChampionRacerAppearance,
  getRacerModelFiles,
  loadBuiltCarScene,
} from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Matrix4, Mesh, Scene } from 'three'
import type { Object3D } from 'three'
import { createModelObject, loadEffectModel } from '../../../track-viewer/index.ts'
import { loadDesignGridOffset } from '../ldraw-car/chassis-grid-offset-loader.ts'
import { createLDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.ts'
import { loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import { createLDrawPickupDrawing } from '../ldraw-pickup/ldraw-pickup-drawing.ts'
import { createLDrawRacerCar } from '../ldraw-racer-model/ldraw-racer-car.ts'
import { RacerPartKind } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import { createLDrawWheelsDrawing } from '../ldraw-racer/ldraw-wheels-drawing.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import { getHolderCentres, getOriginalWheelCentres, getWheelAnchors } from './fidelity-anchors.ts'
import type { FidelityContext, FidelityPairOutcome } from './fidelity-pairs.types.ts'
import { FidelityItemKind } from './ldraw-fidelity.types.ts'
import type { FidelityItem } from './ldraw-fidelity.types.ts'

const CHASSIS_DATABASE_PATH = 'GAMEDATA\\COMMON\\CHASSIS.CMB'
// The colour every lone brick is placed in (index of `L_COLORS.LEB`), as the LDraw gallery does.
const TEST_COLOR_INDEX = 5
const SKELETAL_EXCEPTION = 'BARREL'
const POLL_MILLISECONDS = 100
const STABLE_POLLS = 5
const MAXIMUM_POLLS = 300
const NO_STATE = null

export const getSingleBrickDesign = (piece: BrickPiece): CarDesign => ({
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

const getMeshCount = (object: Object3D): number => {
  let count = 0
  object.traverse((child) => {
    if (child instanceof Mesh) count += 1
  })
  return count
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

// For drawings that say nothing when they are complete: true once they have meshes and their number has not changed for half a second.
export const waitForStableMeshes = async (object: Object3D): Promise<boolean> => {
  let previous = -1
  let stable = 0
  for (let poll = 0; poll < MAXIMUM_POLLS; poll += 1) {
    const count = getMeshCount(object)
    stable = count > 0 && count === previous ? stable + 1 : 0
    if (stable >= STABLE_POLLS) return true
    previous = count
    await wait(POLL_MILLISECONDS)
  }
  return false
}

export const createSceneWith = (...objects: Object3D[]): Scene => {
  const scene = new Scene()
  scene.add(...objects)
  return scene
}

// A drawing in the original's model frame before the model's scale, scaled as the viewer scales the model.
export const createScaledScene = (model: ModelScene, object: Object3D): Scene => {
  const scaled = new Group()
  scaled.scale.setScalar(model.meshScales[0] ?? 1)
  scaled.add(object)
  return createSceneWith(scaled)
}

// The original's model as the race draws it: the race's lights (none: the ambient of 255).
export const createOriginalObject = (model: ModelScene) => {
  const modelObject = createModelObject(model)
  modelObject.object.setLights(null)
  return modelObject
}

const getBrickPiece = (context: FidelityContext, name: string): BrickPiece | null =>
  findBrickPieceByName(parseBrickDatabase(context.archive.readFile(BRICK_DATABASE_PATH)), name)

// A brick (or a chassis part) alone: the original's mesh builder against the LDraw car drawing of the same one-brick design; a chassis
// is drawn from its recipe, and its attachment point is the built bricks' grid against the real base's studs.
const createBrickPair = async (
  context: FidelityContext,
  item: FidelityItem,
  chassisFile: string | null
): Promise<FidelityPairOutcome> => {
  const piece = getBrickPiece(context, item.subject)
  if (piece === null) return `the brick database has no ${item.subject}`
  const recipe = chassisFile === null ? null : await loadLDrawModelText(chassisFile)
  if (item.kind === FidelityItemKind.CHASSIS && recipe === null) return 'no chassis recipe'
  const chassisModels = new Map(recipe === null ? [] : [[item.subject.toLowerCase(), recipe]])
  const design = getSingleBrickDesign(piece)
  const original = createOriginalObject(loadBuiltCarScene(context.archive, design))
  const drawing = createLDrawCarDrawing(
    { archive: context.archive, design },
    true,
    chassisModels,
    null,
    false
  )
  await drawing.shown
  const isChassis = item.kind === FidelityItemKind.CHASSIS
  const offset = isChassis ? await loadDesignGridOffset(design, chassisModels) : null
  return {
    pair: {
      original: createSceneWith(original.group),
      replacement: createSceneWith(drawing.object),
    },
    anchors:
      offset === null
        ? []
        : [
            {
              name: 'brick grid',
              distance: Number(Math.hypot(offset.x, offset.y, offset.z).toFixed(2)),
            },
          ],
    focus: null,
    note:
      drawing.document.unmappedBricks.length > 0 ? 'drawn from the game mesh (no LDraw part)' : '',
    dispose: () => original.object.dispose(),
  }
}

// A brick on the track: the effect's model against its LDraw part (the model's default look).
const createPickupPair = async (
  context: FidelityContext,
  item: FidelityItem
): Promise<FidelityPairOutcome> => {
  const original = createOriginalObject(
    loadEffectModel(context.archive, item.subject, item.subject !== SKELETAL_EXCEPTION)
  )
  const drawing = createLDrawPickupDrawing({ modelName: item.subject, variant: null })
  if (drawing === null) return 'no LDraw mapping'
  const replacement = createSceneWith(drawing)
  if (!(await waitForStableMeshes(replacement))) return 'the LDraw part never arrived'
  return {
    pair: { original: createSceneWith(original.group), replacement },
    anchors: [],
    focus: null,
    note: 'default look',
    dispose: () => original.object.dispose(),
  }
}

const getChassisModelNames = (context: FidelityContext, chassisIndex: number) =>
  parseChassisDatabase(context.archive.readFile(CHASSIS_DATABASE_PATH)).chassis[chassisIndex]
    ?.variants[0] ?? null

// A chassis's wheels at rest (the start of the clip the original starts them in): the original's wheel model against the library's
// tyres and rims on its bones; the attachment points are the wheel centres.
const createWheelsPair = async (
  context: FidelityContext,
  item: FidelityItem
): Promise<FidelityPairOutcome> => {
  const names = getChassisModelNames(context, item.chassisIndex)
  if (names === null) return 'the chassis database has no such chassis'
  const model = loadModelScene(context.archive, getRacerModelFiles(names))
  const sampler = createSkeletonPoseSampler(model)
  const state = sampler?.createState() ?? NO_STATE
  const drawing = createLDrawWheelsDrawing({
    kind: RacerPartKind.WHEELS,
    archive: context.archive,
    model,
    modelName: names.modelName,
    partBytes: null,
  })
  if (sampler === null || drawing === null) return 'no LDraw wheels for this model'
  const original = createModelObject(model)
  if (state !== null) {
    original.object.setAnimationState(state)
    drawing.setAnimationState(state)
  }
  original.object.setLights(null)
  await drawing.settled
  const replacement = createScaledScene(model, drawing.object)
  replacement.updateMatrixWorld(true)
  const matrices = state === null ? sampler.restMatrices : sampler.getMatrices(state)
  return {
    pair: { original: createSceneWith(original.group), replacement },
    anchors: getWheelAnchors(
      getOriginalWheelCentres(model, matrices),
      getHolderCentres(drawing.object.children)
    ),
    focus: null,
    note: '',
    dispose: () => {
      original.object.dispose()
      drawing.dispose()
    },
  }
}

const findChampionAppearance = (context: FidelityContext, code: string) => {
  const databases = readRacerDatabases((path) => context.archive.readFile(path))
  for (const driver of databases.drivers.drivers) {
    const appearance = getChampionRacerAppearance(databases, driver.name, 0)
    if (appearance.bodyModel?.modelName.toUpperCase() === code) return appearance
  }
  return null
}

const getRestPose = (state: SkeletonAnimationState | null) => ({
  matrix: new Matrix4(),
  isVisible: true,
  animationState: state,
})

// A champion's car: the original's body and wheels against the models folder's complete car (body, chassis and wheels), both at the
// car's origin with the wheels at rest; the attachment points are the wheel centres.
const createCarPair = async (
  context: FidelityContext,
  item: FidelityItem
): Promise<FidelityPairOutcome> => {
  const appearance = findChampionAppearance(context, item.subject)
  if (appearance?.bodyModel == null) return `no champion drives ${item.subject}`
  const wheelModel = loadModelScene(context.archive, getRacerModelFiles(appearance.wheelModel))
  const sampler = createSkeletonPoseSampler(wheelModel)
  const state = sampler?.createState() ?? NO_STATE
  const drawing = createLDrawRacerCar(
    {
      archive: context.archive,
      carCode: item.subject,
      design: null,
      wheels: { model: wheelModel, modelName: appearance.wheelModel.modelName, partBytes: null },
    },
    { search: '?hd', isChassisFallbackUsed: false }
  )
  if (drawing === null) return 'the models folder has no file for this car'
  const failure = { isFailed: false }
  drawing.onFailed(() => {
    failure.isFailed = true
  })
  drawing.applyPose({ body: getRestPose(NO_STATE), wheels: getRestPose(state), opacity: 1 })
  const replacement = createSceneWith(drawing.object)
  const isShown = await waitForStableMeshes(replacement)
  if (failure.isFailed || !isShown) return 'the LDraw car could not be built'
  drawing.applyPose({ body: getRestPose(NO_STATE), wheels: getRestPose(state), opacity: 1 })
  const body = createOriginalObject(
    loadModelScene(context.archive, getRacerModelFiles(appearance.bodyModel))
  )
  const wheels = createModelObject(wheelModel)
  if (state !== null) wheels.object.setAnimationState(state)
  wheels.object.setLights(null)
  replacement.updateMatrixWorld(true)
  const wheelsObject = drawing.object.children[1]?.children[0]?.children[0]
  const matrices =
    sampler === null ? [] : state === null ? sampler.restMatrices : sampler.getMatrices(state)
  return {
    pair: { original: createSceneWith(body.group, wheels.group), replacement },
    anchors: getWheelAnchors(
      getOriginalWheelCentres(wheelModel, matrices),
      getHolderCentres(wheelsObject?.children ?? [])
    ),
    focus: null,
    note: item.file ?? '',
    dispose: () => {
      body.object.dispose()
      wheels.object.dispose()
      drawing.dispose()
    },
  }
}

// The pair of an item that is not a driver (see `fidelity-driver-pairs.ts` for those).
export const createObjectPair = (
  context: FidelityContext,
  item: FidelityItem
): Promise<FidelityPairOutcome> => {
  if (item.kind === FidelityItemKind.PICKUP) return createPickupPair(context, item)
  if (item.kind === FidelityItemKind.WHEELS) return createWheelsPair(context, item)
  if (item.kind === FidelityItemKind.CAR) return createCarPair(context, item)
  return createBrickPair(context, item, item.file)
}
