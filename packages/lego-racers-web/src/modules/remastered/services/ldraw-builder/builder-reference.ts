import { EMPTY_START_FILE } from './ldraw-builder-route.ts'
import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import {
  getBuiltRacerAppearance,
  getRacerModelFiles,
  loadBuiltCarScene,
} from '@lego-games/lego-racers/racer-appearance'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { createModelObject, loadEffectModel } from '../../../track-viewer/index.ts'
import {
  createOriginalObject,
  findChampionAppearance,
  getSingleBrickDesign,
} from '../ldraw-fidelity/fidelity-pairs.ts'
import { DEVELOPMENT_LDRAW_MODELS_ROUTE } from '../ldraw-models/ldraw-models-route.ts'
import { loadLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import {
  getChassisRecipeOffset,
  getChassisReferenceLine,
} from '../reference-kit/chassis-reference-line.ts'
import { getWheelMounts } from '../reference-kit/wheel-mounts.ts'
import {
  getOriginalModelBounds,
  getPowerUpReferenceMatrix,
} from '../ldraw-powerup/powerup-object-frame.ts'
import {
  getDefaultHeaderLines,
  getReferencedModelName,
  inlineReferencedModels,
  parseBuilderDocument,
} from '@lego-games/ldraw/building'
import { getBuilderItemFile } from './builder-items.ts'
import type { BuilderItemStart, OriginalReference } from './builder-reference.types.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { BuilderItem, BuilderPart } from './ldraw-builder.types.ts'

const WHEEL_GUIDE_COLOR = 0x37c6ff
const WHEEL_GUIDE_OPACITY = 0.18
const WHEEL_GUIDE_SEGMENTS = 24
const NO_OFFSET = [0, 0, 0] as const
const CHASSIS_RECIPE_FILE = /^chassis\/([^/]+)\.ldr$/i

// A model file's text as it is on disk now (never a cached copy: the builder writes these files).
export const fetchModelText = async (file: string): Promise<string | null> => {
  const response = await fetch(
    `${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${file.split('/').map(encodeURIComponent).join('/')}`,
    { cache: 'no-store' }
  )
  return response.ok ? response.text() : null
}

// The chassis each champion drives (the car code, upper case, to the chassis name, lower case).
export const getChampionChassis = (archive: JamArchive): ReadonlyMap<string, string> =>
  new Map(
    readRacerDatabases((path) => archive.readFile(path)).champions.champions.map((champion) => [
      champion.modelName.toUpperCase(),
      champion.chassisName.toLowerCase(),
    ])
  )

const createOriginalWheels = (archive: JamArchive, names: ModelResourceNames) => {
  const model = loadModelScene(archive, getRacerModelFiles(names))
  return createOriginalObject(model, createSkeletonPoseSampler(model)?.createState() ?? null)
}

// A power-up object's mesh as its file stores it (the frame its LDraw file is drawn in), shown in studs of the power-up brick on the
// ground (powerup-object-frame.ts).
const createPowerUpReference = (archive: JamArchive, name: string): OriginalReference => {
  const model = loadEffectModel(archive, name, false)
  const original = createModelObject(model)
  original.group.matrix.copy(getPowerUpReferenceMatrix(getOriginalModelBounds(model)))
  const object = new Group()
  object.add(original.group)
  return { object, dispose: () => original.object.dispose() }
}

// The original's model of the item at rest, as the race draws it, in the car's frame (studs, z up): a champion's body and wheels, or
// a chassis brick alone with the wheels the game puts on it; a power-up object's mesh. None for a driver.
export const createOriginalReference = (
  archive: JamArchive,
  item: BuilderItem
): OriginalReference | null => {
  if (item.kind === BuilderItemKind.DRIVER) return null
  if (item.kind === BuilderItemKind.POWER_UP) return createPowerUpReference(archive, item.name)
  if (item.kind === BuilderItemKind.CAR) {
    const appearance = findChampionAppearance({ archive }, item.name)
    if (appearance?.bodyModel == null) return null
    const body = createOriginalObject(
      loadModelScene(archive, getRacerModelFiles(appearance.bodyModel))
    )
    const wheels = createOriginalWheels(archive, appearance.wheelModel)
    const object = new Group()
    object.add(body.group, wheels.group)
    return {
      object,
      dispose: () => {
        body.object.dispose()
        wheels.object.dispose()
      },
    }
  }
  const piece = findBrickPieceByName(
    parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH)),
    item.chassisName
  )
  if (piece === null) return null
  const chassis = createOriginalObject(loadBuiltCarScene(archive, getSingleBrickDesign(piece)))
  const wheels = createOriginalWheels(
    archive,
    getBuiltRacerAppearance(readRacerDatabases(archive.readFile), item.chassisName, 0).wheelModel
  )
  const object = new Group()
  object.add(chassis.group, wheels.group)
  return {
    object,
    dispose: () => {
      chassis.object.dispose()
      wheels.object.dispose()
    },
  }
}

// See-through cylinders where the game puts the item's wheels (car frame, studs): a body leaves room for them.
export const createWheelGuides = (archive: JamArchive, chassisName: string): Group => {
  const guides = new Group()
  const material = new MeshBasicMaterial({
    color: WHEEL_GUIDE_COLOR,
    transparent: true,
    opacity: WHEEL_GUIDE_OPACITY,
    depthWrite: false,
  })
  for (const mount of getWheelMounts(archive, chassisName)) {
    const wheel = new Mesh(
      new CylinderGeometry(mount.radius, mount.radius, mount.width, WHEEL_GUIDE_SEGMENTS),
      material
    )
    wheel.position.set(...mount.centre)
    wheel.raycast = () => undefined
    guides.add(wheel)
  }
  return guides
}

const ITEM_TITLES: Readonly<Record<BuilderItemKind, (name: string) => string>> = Object.freeze({
  [BuilderItemKind.CHASSIS]: (name: string) =>
    `Racers chassis ${name.toUpperCase()} (recipe frame: footprint corner, x width, y depth, z up from the brick bottom)`,
  [BuilderItemKind.CAR]: (name: string) => `Racers champion car ${name}`,
  [BuilderItemKind.POWER_UP]: (name: string) =>
    `Racers power-up object ${name} (fitted to the original's size in the race, front along x)`,
  [BuilderItemKind.DRIVER]: (name: string) =>
    `${name} driver (origin the top of the hips, standing rest pose; each part after its 0 !RACERS ROLE line)`,
})

const getTitle = (item: BuilderItem): string => ITEM_TITLES[item.kind](item.name)

// The parts of the chassis recipes a car's reference lines place, by recipe name, in the recipe's own frame.
const loadReferencedRecipes = async (
  referenceLines: readonly string[]
): Promise<ReadonlyMap<string, readonly BuilderPart[]>> => {
  const index = await loadLDrawModelIndex()
  const recipes = await Promise.all(
    referenceLines.map(async (line): Promise<readonly [string, readonly BuilderPart[]] | null> => {
      const name = getReferencedModelName(line)
      const file = name === null ? undefined : index.chassis[name]
      const text = file === undefined ? null : await fetchModelText(file)
      return name === null || text === null ? null : [name, parseBuilderDocument(text).parts]
    })
  )
  return new Map(recipes.filter((recipe) => recipe !== null))
}

// The chassis brick a `chassis/<NAME>.ldr` start file is the recipe of, null for any other file.
const findChassisRecipePiece = (database: BrickDatabase, file: string): BrickPiece | null => {
  const match = CHASSIS_RECIPE_FILE.exec(file)
  return match?.[1] === undefined ? null : findBrickPieceByName(database, match[1].toLowerCase())
}

// What an item starts from: the file in the models folder (or the one given), else (or for EMPTY_START_FILE) an empty model. A
// champion's car is one whole model (chassis and body, everything but the wheels): an older car file that places a chassis recipe
// gets the recipe's parts as its own, so Done writes it flat, and a car started from a chassis recipe gets a copy of its parts where
// the game puts that chassis (no link to the recipe). A chassis is edited in its recipe frame, which sits at its offset in the car's
// frame.
export const loadBuilderItemStart = async (
  archive: JamArchive,
  item: BuilderItem,
  startFile: string | null
): Promise<BuilderItemStart> => {
  const index = await loadLDrawModelIndex()
  const existing = [
    ...Object.values(index.cars),
    ...Object.values(index.chassis),
    ...Object.values(index.drivers),
    ...Object.values(index.powerUps),
  ]
  const file = getBuilderItemFile(item.id, existing) ?? `${item.name}.ldr`
  const sourceFile =
    startFile ?? (existing.some((path) => path.toLowerCase() === file.toLowerCase()) ? file : null)
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const piece = findBrickPieceByName(database, item.chassisName)
  const isChassis = item.kind === BuilderItemKind.CHASSIS
  const recipePiece =
    isChassis || sourceFile === null ? null : findChassisRecipePiece(database, sourceFile)
  const text =
    recipePiece !== null
      ? getChassisReferenceLine(database, recipePiece)
      : sourceFile === null || sourceFile === EMPTY_START_FILE
        ? null
        : await fetchModelText(sourceFile)
  const parsed = parseBuilderDocument(text ?? '')
  const document = isChassis
    ? parsed
    : inlineReferencedModels(parsed, await loadReferencedRecipes(parsed.referenceLines))
  return {
    file,
    sourceFile,
    document: Object.freeze({
      ...document,
      headerLines:
        document.headerLines.length > 0
          ? document.headerLines
          : getDefaultHeaderLines(getTitle(item), file.split('/').pop() ?? file),
    }),
    editOffset: isChassis && piece !== null ? getChassisRecipeOffset(database, piece) : NO_OFFSET,
  }
}
