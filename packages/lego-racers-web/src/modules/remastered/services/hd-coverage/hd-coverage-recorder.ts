import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { Object3D } from 'three'
import type {
  CarDrawingRequest,
  DriverDrawingRequest,
  ViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { findDriverSource } from '../ldraw-racer/driver-records.ts'
import { HookKind } from './hd-coverage.types.ts'
import type { HookCall } from './hd-coverage.types.ts'
import type { CoverageRecorder, RecordingExtension } from './hd-coverage-recorder.types.ts'
import { DESIGN_KEY_PREFIX, PARTS_KEY_PREFIX } from './racer-part-classification.ts'

// The builder's own bricks start at this id; a lower one is the design's chassis (`FIRST_BUILDER_BRICK_ID` of the layer's car).
const FIRST_BUILDER_BRICK_ID = 0x800
const CALL_ID_KEY = 'hdCoverageCallId'

const getChassisName = (design: CarDesign): string =>
  design.bricks
    .find((brick) => brick.piece.id < FIRST_BUILDER_BRICK_ID)
    ?.piece.name.toLowerCase() ?? ''

const getCarCall = (id: number, request: CarDrawingRequest): HookCall => {
  const index = getLDrawModelIndex()
  const chassis = request.design === null ? null : getChassisName(request.design)
  const code = request.carCode?.toUpperCase() ?? ''
  return Object.freeze({
    id,
    hook: HookKind.CAR,
    key: chassis === null ? code : `${DESIGN_KEY_PREFIX}${chassis}`,
    wheelsKey: request.wheels.modelName?.toUpperCase() ?? null,
    isModelPresent:
      chassis === null ? index.cars[code] !== undefined : index.chassis[chassis] !== undefined,
    isDrawingReturned: false,
    isFailed: false,
  })
}

const getDriverCall = (id: number, request: DriverDrawingRequest): HookCall =>
  Object.freeze({
    id,
    hook: HookKind.DRIVER,
    key:
      request.driver.partBytes === null
        ? (request.driver.modelName ?? '').toUpperCase()
        : `${PARTS_KEY_PREFIX}${request.driver.partBytes.join(' ')}`,
    wheelsKey: null,
    isModelPresent:
      findDriverSource(request.archive, request.driver.modelName, request.driver.partBytes) !==
      null,
    isDrawingReturned: false,
    isFailed: false,
  })

const getHasMesh = (object: Object3D): boolean =>
  object.getObjectByProperty('isMesh', true) !== undefined

// Wraps an extension so every call of its car and driver hooks is recorded with its outcome, and the drawings it returns can be
// told apart in a rendered scene.
export const createRecordingExtension = (extension: ViewerExtension): RecordingExtension => {
  let calls = new Map<number, HookCall>()
  let drawings = new Map<number, Object3D>()
  let nextId = 1
  const update = (id: number, change: Partial<HookCall>) => {
    const call = calls.get(id)
    if (call !== undefined) calls = new Map(calls).set(id, Object.freeze({ ...call, ...change }))
  }
  const begin = (call: HookCall) => {
    calls = new Map(calls).set(call.id, call)
    nextId += 1
    return call.id
  }
  const keep = (id: number, object: Object3D) => {
    Object.assign(object.userData, { [CALL_ID_KEY]: id })
    drawings = new Map(drawings).set(id, object)
    update(id, { isDrawingReturned: true })
  }
  const recorded: ViewerExtension = {
    ...extension,
    getCarDrawing: (request) => {
      const id = begin(getCarCall(nextId, request))
      try {
        const drawing = extension.getCarDrawing(request)
        if (drawing === null) return null
        keep(id, drawing.object)
        drawing.onFailed(() => update(id, { isFailed: true }))
        return drawing
      } catch (error: unknown) {
        update(id, { isFailed: true })
        throw error
      }
    },
    getDriverDrawing: (request) => {
      const id = begin(getDriverCall(nextId, request))
      const drawing = extension.getDriverDrawing(request)
      if (drawing !== null) keep(id, drawing.object)
      return drawing
    },
  }
  const recorder: CoverageRecorder = {
    reset: () => {
      calls = new Map()
      drawings = new Map()
    },
    getCalls: () => [...calls.values()],
    getCallId: (object) => {
      const id: unknown = object.userData[CALL_ID_KEY]
      return typeof id === 'number' ? id : null
    },
    getUnsettledCallIds: () =>
      [...drawings].flatMap(([id, object]) =>
        calls.get(id)?.isFailed === true || getHasMesh(object) ? [] : [id]
      ),
  }
  return { extension: recorded, recorder }
}
