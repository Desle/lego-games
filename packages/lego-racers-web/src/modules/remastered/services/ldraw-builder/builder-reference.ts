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
import { parseEmitters } from '@lego-games/lego-racers/emitter'
import { loadModelScene, SceneInstanceKind } from '@lego-games/lego-racers/scene'
import type { ModelScene, SceneMesh } from '@lego-games/lego-racers/scene'
import { getParticlePartText } from '@lego-games/ldraw/particles'
import { Box3, Box3Helper, CylinderGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import type { Material, Object3D } from 'three'
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
import { POWER_UP_SPRITES } from '../ldraw-powerup/powerup-sprites.ts'
import type { PowerUpSprite } from '../ldraw-powerup/powerup-sprites.types.ts'
import {
  getFittedPowerUpScale,
  getFittedSpriteScale,
  getOriginalFrameBounds,
  getOriginalModelBounds,
  getParticleSizeInStuds,
  getPowerUpReferenceMatrix,
} from '../ldraw-powerup/powerup-object-frame.ts'
import {
  LDRAW_PARTICLE_PARTS,
  LDRAW_PARTICLE_REFERENCES,
} from '../ldraw-particles/ldraw-particle-mappings.ts'
import { LDrawParticleKind } from '../ldraw-particles/ldraw-particle-mappings.types.ts'
import type { LDrawParticleReference } from '../ldraw-particles/ldraw-particle-mappings.types.ts'
import { getModelFileScale, removeScaleMeta } from '../ldraw-scale-meta/ldraw-scale-meta.ts'
import {
  getDefaultHeaderLines,
  getReferencedModelName,
  inlineReferencedModels,
  parseBuilderDocument,
} from '@lego-games/ldraw/building'
import { getBuilderItemFile } from './builder-items.ts'
import { getPowerUpReferenceShape } from './builder-reference-shape.ts'
import { ReferenceShape } from './builder-reference.types.ts'
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

const getIsSeeThrough = (object: Object3D): boolean => {
  let isSeeThrough = false
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const materials: readonly Material[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    if (materials.some((material) => material.transparent)) isSeeThrough = true
  })
  return isSeeThrough
}

// The reference with its world matrices brought up to date (a group the race poses has no automatic matrix, so a bounds query
// before the first frame would see its mesh unscaled) and the bounds of what it shows.
const createShownReference = (
  object: Group,
  dispose: () => void,
  getShape: (bounds: Box3) => ReferenceShape,
  getFittedScale: (fileBounds: Box3) => number = getRealScale
): OriginalReference => {
  object.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(object)
  return { object, dispose, bounds, shape: getShape(bounds), getFittedScale }
}

const getRealScale = (): number => 1

// A power-up object's mesh as its file stores it (the frame its LDraw file is drawn in), shown in studs of the power-up brick on the
// ground (powerup-object-frame.ts), drawn as race-effects draws it.
const createPowerUpReference = (archive: JamArchive, name: string): OriginalReference => {
  const model = loadEffectModel(archive, name, false)
  const original = createModelObject(model)
  const posedBounds = getOriginalModelBounds(model)
  const frameBounds = getOriginalFrameBounds(loadAnimatedEffectModel(archive, name) ?? model)
  original.group.matrix.copy(getPowerUpReferenceMatrix(frameBounds))
  // A mesh the race poses bone by bone (a turbo's flame) is shown as stored; the box is the room it takes while it plays.
  if (posedBounds.isEmpty() && !frameBounds.isEmpty()) {
    const room = new Box3Helper(frameBounds, ANIMATED_ROOM_COLOR)
    room.raycast = () => undefined
    original.group.add(room)
  }
  const object = new Group()
  object.add(original.group)
  return createShownReference(
    object,
    () => original.object.dispose(),
    (bounds) => getPowerUpReferenceShape(posedBounds, bounds, getIsSeeThrough(object)),
    (fileBounds) => getFittedPowerUpScale(frameBounds, fileBounds)
  )
}

// The models the race loads without a skeleton (race-assets); the others play their own animation, the shields SHEOUT0's.
const SKELETON_FREE_MODELS: readonly string[] = ['BARREL', 'HEDRA01', 'SPIKEXP', 'WARPHOLE']
const SHIELD_PREFIX = 'SHEOUT'
const SHIELD_SKELETON = 'SHEOUT0'
const ANIMATED_ROOM_COLOR = 0xff9a3c

// The model with its skeleton and animation, as the race loads it; null for one the race loads without.
const loadAnimatedEffectModel = (archive: JamArchive, name: string): ModelScene | null => {
  if (SKELETON_FREE_MODELS.includes(name)) return null
  try {
    return loadEffectModel(
      archive,
      name,
      true,
      name.startsWith(SHIELD_PREFIX) ? SHIELD_SKELETON : name
    )
  } catch {
    return null
  }
}

const WHITE = 255
const CARD_CORNERS = 4
const COLOR_COMPONENTS = 4
const IDENTITY_ROTATION = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1] as const)

// The size of the emitter's quad (race units): its first size, or its last when it starts at nothing.
const getReferenceQuadSize = (
  archive: JamArchive,
  reference: LDrawParticleReference
): readonly [number, number] => {
  const emitter = parseEmitters(archive.readFile(reference.emitterPath)).emitters.find(
    (candidate) => candidate.name === reference.emitterName
  )
  if (emitter === undefined) return [1, 1]
  return emitter.firstFloat > 0 && emitter.secondFloat > 0
    ? [emitter.firstFloat, emitter.secondFloat]
    : [emitter.firstFloat + emitter.thirdFloat, emitter.secondFloat + emitter.fourthFloat]
}

// The quad lying on the ground facing up (the builder's camera looks down on the studs, as the race's looks at them): x along its
// right side, its top edge toward -y (LDraw z, up the quad), both faces drawn.
const getCardMesh = (width: number, height: number, materialIndex: number): SceneMesh => {
  const right = width / 2
  const down = height / 2
  return Object.freeze({
    name: 'card',
    path: '',
    vertexCount: CARD_CORNERS,
    positions: new Float32Array([
      -right,
      -down,
      0,
      right,
      -down,
      0,
      right,
      down,
      0,
      -right,
      down,
      0,
    ]),
    textureCoordinates: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    colors: new Uint8Array(CARD_CORNERS * COLOR_COMPONENTS).fill(WHITE),
    normals: null,
    materialIndices: [materialIndex],
    boundingSphere: null,
    drawBatches: [
      Object.freeze({
        materialSlot: 0,
        firstCommand: 0,
        vertexIndices: new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]),
        transformIndices: new Uint8Array(12),
      }),
    ],
  })
}

// A flat card of an original's material (from the library of `card.library` in `card.directory`) `card.width` by `card.height` race
// units, in car studs on the ground (powerup-object-frame.ts), drawn with the original's material.
const createCardReference = (
  archive: JamArchive,
  card: PowerUpSprite,
  getFittedScale: (fileBounds: Box3) => number
): OriginalReference => {
  const resources = loadModelScene(archive, {
    directory: card.directory,
    textureNames: [card.library],
    materialNames: [card.library],
    meshNames: [],
    skeletonName: null,
    animationName: null,
  })
  const materialIndex = resources.scene.materials.findLastIndex(
    (material) => material.name === card.materialName
  )
  const mesh = getCardMesh(
    getParticleSizeInStuds(card.width),
    getParticleSizeInStuds(card.height),
    materialIndex
  )
  const model: ModelScene = Object.freeze({
    meshScales: Object.freeze([1]),
    scene: Object.freeze({
      ...resources.scene,
      meshes: Object.freeze([mesh]),
      instances: Object.freeze([
        Object.freeze({
          name: 'card',
          kind: SceneInstanceKind.MESH,
          worldPath: card.directory,
          startClipIndex: null,
          textureScrollPerSecond: null,
          levels: Object.freeze([
            Object.freeze({
              meshIndex: 0,
              skeletonIndex: null,
              animationIndex: null,
              materialAssignmentIndex: null,
              bspTreeIndex: null,
              squaredDistance: Number.MAX_VALUE,
            }),
          ]),
          position: Object.freeze({ x: 0, y: 0, z: 0 }),
          rotation: IDENTITY_ROTATION,
        }),
      ]),
    }),
  })
  const original = createModelObject(model)
  const object = new Group()
  object.add(original.group)
  return createShownReference(
    object,
    () => original.object.dispose(),
    getSolidShape,
    getFittedScale
  )
}

// A kind of particle's original: the quad of its first row's material at the size an emitter of it starts at.
const createParticleReference = (archive: JamArchive, name: string): OriginalReference | null => {
  const kind = Object.values(LDrawParticleKind).find((value) => value === name.toLowerCase())
  if (kind === undefined) return null
  const reference = LDRAW_PARTICLE_REFERENCES[kind]
  const [width, height] = getReferenceQuadSize(archive, reference)
  return createCardReference(archive, { ...reference, width, height }, getRealScale)
}

// The model a kind of particle starts from without a file: the part the race draws it with.
const getParticleStartText = (name: string): string | null => {
  const kind = Object.values(LDrawParticleKind).find((value) => value === name.toLowerCase())
  if (kind === undefined) return null
  const part = LDRAW_PARTICLE_PARTS[kind]
  return getParticlePartText(part.partName, part.colorCode)
}

const getSolidShape = (): ReferenceShape => ReferenceShape.SOLID

// The original's model of the item at rest, as the race draws it, in the car's frame (studs, z up): a champion's body and wheels, or
// a chassis brick alone with the wheels the game puts on it; a power-up object's mesh; a particle's quad. None for a driver.
export const createOriginalReference = (
  archive: JamArchive,
  item: BuilderItem
): OriginalReference | null => {
  if (item.kind === BuilderItemKind.DRIVER) return null
  const sprite = POWER_UP_SPRITES[item.name]
  if (item.kind === BuilderItemKind.POWER_UP && sprite !== undefined) {
    return createCardReference(archive, sprite, (fileBounds) =>
      getFittedSpriteScale(Math.max(sprite.width, sprite.height), fileBounds)
    )
  }
  if (item.kind === BuilderItemKind.POWER_UP) return createPowerUpReference(archive, item.name)
  if (item.kind === BuilderItemKind.PARTICLE) return createParticleReference(archive, item.name)
  if (item.kind === BuilderItemKind.CAR) {
    const appearance = findChampionAppearance({ archive }, item.name)
    if (appearance?.bodyModel == null) return null
    const body = createOriginalObject(
      loadModelScene(archive, getRacerModelFiles(appearance.bodyModel))
    )
    const wheels = createOriginalWheels(archive, appearance.wheelModel)
    const object = new Group()
    object.add(body.group, wheels.group)
    return createShownReference(
      object,
      () => {
        body.object.dispose()
        wheels.object.dispose()
      },
      getSolidShape
    )
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
  return createShownReference(
    object,
    () => {
      chassis.object.dispose()
      wheels.object.dispose()
    },
    getSolidShape
  )
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
    `Racers power-up object ${name} (front along x; 0 !RACERS SCALE: studs of the power-up brick)`,
  [BuilderItemKind.PARTICLE]: (name: string) =>
    `Racers particle ${name} (studs to the camera, LDraw z up the quad; 0 !RACERS SCALE: car studs)`,
  [BuilderItemKind.DRIVER]: (name: string) =>
    `${name} driver (origin the top of the hips, standing rest pose; each part after its 0 !RACERS ROLE line)`,
})

const getTitle = (item: BuilderItem): string =>
  POWER_UP_SPRITES[item.name] === undefined
    ? ITEM_TITLES[item.kind](item.name)
    : `Racers power-up sprite ${item.name} (origin at the sprite's centre, studs to the camera; 0 !RACERS SCALE: car studs)`

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
    ...Object.values(index.particles),
  ]
  const file = getBuilderItemFile(item.id, existing) ?? `${item.name}.ldr`
  const sourceFile =
    startFile ?? (existing.some((path) => path.toLowerCase() === file.toLowerCase()) ? file : null)
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const piece = findBrickPieceByName(database, item.chassisName)
  const isChassis = item.kind === BuilderItemKind.CHASSIS
  const recipePiece =
    isChassis || sourceFile === null ? null : findChassisRecipePiece(database, sourceFile)
  const isParticle = item.kind === BuilderItemKind.PARTICLE
  const text =
    recipePiece !== null
      ? getChassisReferenceLine(database, recipePiece)
      : sourceFile === null || sourceFile === EMPTY_START_FILE
        ? isParticle && sourceFile === null
          ? getParticleStartText(item.name)
          : null
        : await fetchModelText(sourceFile)
  const parsed = removeScaleMeta(parseBuilderDocument(text ?? ''))
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
    scale: getModelFileScale(text ?? ''),
    editOffset: isChassis && piece !== null ? getChassisRecipeOffset(database, piece) : NO_OFFSET,
  }
}
