import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
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
  getDefaultHeaderLines,
  getReferencedModelName,
  parseBuilderDocument,
  placeReferencedParts,
} from './builder-document.ts'
import { getBuilderItemFile } from './builder-items.ts'
import type { BuilderItemStart, OriginalReference } from './builder-reference.types.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'
import type { BuilderItem, BuilderPart } from './ldraw-builder.types.ts'

const WHEEL_GUIDE_COLOR = 0x37c6ff
const WHEEL_GUIDE_OPACITY = 0.18
const WHEEL_GUIDE_SEGMENTS = 24
const NO_OFFSET = [0, 0, 0] as const

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

// The original's model of the item at rest, as the race draws it, in the car's frame (studs, z up): a champion's body and wheels, or
// a chassis brick alone with the wheels the game puts on it.
export const createOriginalReference = (
  archive: JamArchive,
  item: BuilderItem
): OriginalReference | null => {
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

const getTitle = (item: BuilderItem): string =>
  item.kind === BuilderItemKind.CHASSIS
    ? `Racers chassis ${item.name.toUpperCase()} (recipe frame: footprint corner, x width, y depth, z up from the brick bottom)`
    : `Racers champion car ${item.name}`

// The chassis recipes a car's reference lines place, as parts in the car's frame (shown and stacked on, never edited).
const loadReferencedParts = async (
  referenceLines: readonly string[]
): Promise<readonly BuilderPart[]> => {
  const index = await loadLDrawModelIndex()
  const placed = await Promise.all(
    referenceLines.map(async (line) => {
      const name = getReferencedModelName(line)
      const file = name === null ? undefined : index.chassis[name]
      const text = file === undefined ? null : await fetchModelText(file)
      return text === null ? [] : placeReferencedParts(line, parseBuilderDocument(text).parts)
    })
  )
  return placed.flat()
}

// What an item starts from: the file in the models folder (or the one given), else an empty model (a car with its chassis recipe
// placed by the reference sheet's line). A chassis is edited in its recipe frame, which sits at its offset in the car's frame.
export const loadBuilderItemStart = async (
  archive: JamArchive,
  item: BuilderItem,
  startFile: string | null
): Promise<BuilderItemStart> => {
  const index = await loadLDrawModelIndex()
  const existing = [...Object.values(index.cars), ...Object.values(index.chassis)]
  const file = getBuilderItemFile(item.id, existing) ?? `${item.name}.ldr`
  const sourceFile =
    startFile ?? (existing.some((path) => path.toLowerCase() === file.toLowerCase()) ? file : null)
  const text = sourceFile === null ? null : await fetchModelText(sourceFile)
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const piece = findBrickPieceByName(database, item.chassisName)
  const isChassis = item.kind === BuilderItemKind.CHASSIS
  const parsed = parseBuilderDocument(text ?? '')
  const document = Object.freeze({
    ...parsed,
    headerLines:
      parsed.headerLines.length > 0
        ? parsed.headerLines
        : getDefaultHeaderLines(getTitle(item), file.split('/').pop() ?? file),
    referenceLines:
      text === null && !isChassis && piece !== null
        ? [getChassisReferenceLine(database, piece)]
        : parsed.referenceLines,
  })
  return {
    file,
    sourceFile,
    document,
    lockedParts: isChassis ? [] : await loadReferencedParts(document.referenceLines),
    editOffset: isChassis && piece !== null ? getChassisRecipeOffset(database, piece) : NO_OFFSET,
  }
}
