import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece, CarDesign } from '@lego-games/lego-racers/car-builder'
import { Group } from 'three'
import type {
  CarDrawing,
  CarDrawingPose,
  CarDrawingRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createChassisFallbackText } from '../ldraw-chassis/chassis-fallback.ts'
import { createDetailedBody } from '../ldraw-car/detailed-body.ts'
import { createLDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.ts'
import { getChassisFileName, LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import { getLDrawModelIndex, loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import { RacerPartKind } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import type { RacerPartDrawingRequest } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import { disposeObject } from '../ldraw-racer/dispose-object.ts'
import { createLDrawWheelsDrawing } from '../ldraw-racer/ldraw-wheels-drawing.ts'
import { setDrawingOpacity } from './drawing-opacity.ts'
import { createCarStudio } from '../ldraw-racer/studio-scene-lights.ts'
import { createFileWheelsDrawing } from './file-wheels-drawing.ts'
import type {
  FoundWheel,
  LDrawCarLiveState,
  LDrawCarSource,
  LDrawRacerSettings,
} from './ldraw-racer-model.types.ts'
import { upgradeWheels } from './racer-model-parts.ts'

const FIRST_BUILDER_BRICK_ID = 0x800
const REFERENCE_LINE = /^1(?:\s+\S+){13}\s+(\S+)\.(?:ldr|dat)\s*$/i

const getChassisPiece = (design: CarDesign): BrickPiece | null =>
  design.bricks.find((brick) => brick.piece.id < FIRST_BUILDER_BRICK_ID)?.piece ?? null

// A car of the models folder by its body code, or a garage design whose chassis part has a recipe in the folder or may be drawn from
// the game's geometry; null for the rest, which the original draws (never half and half).
const getCarSource = (
  request: CarDrawingRequest,
  settings: LDrawRacerSettings
): LDrawCarSource | null => {
  const index = getLDrawModelIndex()
  if (request.design !== null) {
    const chassis = getChassisPiece(request.design)
    if (chassis === null) return null
    const isRecipeKnown = index.chassis[chassis.name.toLowerCase()] !== undefined
    return isRecipeKnown || settings.isChassisFallbackUsed ? { kind: 'design', chassis } : null
  }
  const file = request.carCode === null ? undefined : index.cars[request.carCode.toUpperCase()]
  return file === undefined ? null : { kind: 'file', file }
}

// The text of the chassis recipes a model refers to (by `<chassis>.ldr` lines): the folder's recipe, or the game's geometry when the
// page asks for it.
const loadChassisModels = async (
  archive: CarDrawingRequest['archive'],
  database: BrickDatabase,
  names: readonly string[],
  settings: LDrawRacerSettings
): Promise<ReadonlyMap<string, string>> => {
  const index = getLDrawModelIndex()
  const texts = await Promise.all(
    names.map(async (name): Promise<readonly [string, string] | null> => {
      const file = index.chassis[name]
      const text = file === undefined ? null : await loadLDrawModelText(file)
      if (text !== null) return [name, text]
      const piece = settings.isChassisFallbackUsed ? findBrickPieceByName(database, name) : null
      return piece === null ? null : [name, createChassisFallbackText(archive, database, piece)]
    })
  )
  return new Map(texts.filter((entry): entry is readonly [string, string] => entry !== null))
}

export const getReferencedChassisNames = (text: string): readonly string[] => {
  const known = Object.keys(getLDrawModelIndex().chassis)
  const referenced = text
    .split('\n')
    .map((line) => REFERENCE_LINE.exec(line)?.[1]?.toLowerCase() ?? '')
  return [...new Set(referenced.filter((name) => name !== ''))].filter(
    (name) => known.includes(name) || name.length > 0
  )
}

const getFileText = async (
  file: string,
  chassisModels: ReadonlyMap<string, string>
): Promise<string | null> => {
  const text = await loadLDrawModelText(file)
  return text === null
    ? null
    : [
        text,
        ...[...chassisModels].map(
          ([name, chassisText]) => `0 FILE ${getChassisFileName(name)}\n${chassisText}`
        ),
      ].join('\n')
}

const getPartRequest = (request: CarDrawingRequest): RacerPartDrawingRequest => ({
  kind: RacerPartKind.WHEELS,
  archive: request.archive,
  model: request.wheels.model,
  modelName: request.wheels.modelName,
  partBytes: null,
})

const createIdentityHolder = (): Group => {
  const holder = new Group()
  holder.matrixAutoUpdate = false
  return holder
}

// A car as a complete LDraw model: the body in the frame of the mesh the original draws (studs, z up), its chassis from the
// recipe, and the wheels either the model's own (found by their parts' category) or the library's, put on the original's wheel bones.
// Null when no complete model exists for the car.
export const createLDrawRacerCar = (
  request: CarDrawingRequest,
  settings: LDrawRacerSettings
): CarDrawing | null => {
  const source = getCarSource(request, settings)
  if (source === null) return null
  const object = new Group()
  const bodyHolder = createIdentityHolder()
  const wheelsHolder = createIdentityHolder()
  const wheelsScaled = new Group()
  wheelsScaled.scale.setScalar(request.wheels.model.meshScales[0] ?? 1)
  wheelsHolder.add(wheelsScaled)
  object.add(bodyHolder, wheelsHolder)
  const studio = createCarStudio()
  const foundWheels: FoundWheel[] = []
  const failureListeners: (() => void)[] = []
  const live: LDrawCarLiveState = { wheels: null, state: null, opacity: 1, isDisposed: false }
  const getIsDisposed = () => live.isDisposed
  const database = parseBrickDatabase(request.archive.readFile(BRICK_DATABASE_PATH))
  const keepModelParts = (wheels: readonly FoundWheel[], detail: LDrawDetail) => {
    if (detail === LDrawDetail.LOW) foundWheels.push(...wheels)
    else upgradeWheels(foundWheels, wheels)
  }
  const sourceName = source.kind === 'design' ? `${source.chassis.name}.ldr` : source.file
  const buildBody = async (): Promise<boolean> => {
    if (source.kind === 'design') {
      const name = source.chassis.name.toLowerCase()
      const chassisModels = await loadChassisModels(request.archive, database, [name], settings)
      if (request.design === null || getIsDisposed()) return false
      if (chassisModels.size === 0) {
        console.warn(
          `The chassis recipe ${sourceName} is missing or unreadable; the original car is drawn`
        )
        return false
      }
      const drawing = createLDrawCarDrawing(
        { archive: request.archive, design: request.design },
        true,
        chassisModels,
        keepModelParts,
        false
      )
      bodyHolder.add(drawing.object)
      await drawing.shown
      return true
    }
    const text = await loadLDrawModelText(source.file)
    if (text === null) {
      console.warn(
        `The LDraw model ${source.file} is missing or unreadable; the original car is drawn`
      )
      return false
    }
    if (getIsDisposed()) return false
    const chassisModels = await loadChassisModels(
      request.archive,
      database,
      getReferencedChassisNames(text),
      settings
    )
    const fileText = await getFileText(source.file, chassisModels)
    if (fileText === null || getIsDisposed()) return false
    const body = createDetailedBody(fileText, keepModelParts)
    await body.shown
    if (getIsDisposed()) return false
    const holder = createIdentityHolder()
    holder.matrix.copy(LDRAW_TO_STUDS)
    holder.add(body.object)
    bodyHolder.add(holder)
    return true
  }
  const buildWheels = () => {
    if (getIsDisposed()) return
    const partRequest = getPartRequest(request)
    live.wheels =
      foundWheels.length > 0
        ? createFileWheelsDrawing(foundWheels, partRequest)
        : createLDrawWheelsDrawing(partRequest)
    if (live.wheels === null) return
    wheelsScaled.add(live.wheels.object)
    if (live.state !== null) live.wheels.setAnimationState(live.state)
    setDrawingOpacity(object, live.opacity)
  }
  const settle = (isBuilt: boolean) => {
    if (isBuilt || getIsDisposed()) return
    failureListeners.forEach((listener) => listener())
  }
  void buildBody()
    .then((isBuilt) => {
      if (isBuilt) buildWheels()
      settle(isBuilt)
    })
    .catch((error: unknown) => {
      console.warn(
        `The LDraw car for ${sourceName} could not be built; the original car is drawn`,
        error
      )
      settle(false)
    })
  const placeHolder = (holder: Group, pose: CarDrawingPose['wheels']) => {
    holder.matrix.copy(pose.matrix)
    Object.assign(holder, { visible: pose.isVisible, matrixWorldNeedsUpdate: true })
  }
  return Object.freeze({
    object,
    applyPose: (pose: CarDrawingPose) => {
      placeHolder(bodyHolder, pose.body ?? pose.wheels)
      studio.follow(object, bodyHolder.matrix)
      placeHolder(wheelsHolder, pose.wheels)
      if (pose.wheels.animationState !== null) {
        live.state = pose.wheels.animationState
        live.wheels?.setAnimationState(live.state)
      }
      if (pose.opacity !== live.opacity) {
        live.opacity = pose.opacity
        setDrawingOpacity(object, live.opacity)
      }
    },
    onFailed: (listener) => failureListeners.push(listener),
    dispose: () => {
      live.isDisposed = true
      studio.release()
      disposeObject(bodyHolder)
      live.wheels?.dispose()
    },
  })
}
