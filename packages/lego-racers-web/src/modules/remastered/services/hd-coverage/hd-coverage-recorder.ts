import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { Object3D } from 'three'
import type {
  CarDrawingRequest,
  DriverDrawingRequest,
  EffectModelDrawingRequest,
  ParticleDrawingRequest,
  ViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { getIsParticleMaterialDrawn } from '../ldraw-particles/ldraw-particle-drawing.ts'
import {
  getEffectModelDrawingSource,
  POWER_UP_DRAWING_FAILED_KEY,
} from '../ldraw-powerup/powerup-object-drawing.ts'
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

const getEffectModelCall = (id: number, request: EffectModelDrawingRequest): HookCall =>
  Object.freeze({
    id,
    hook: HookKind.EFFECT_MODEL,
    key: request.modelName,
    wheelsKey: null,
    isModelPresent: getEffectModelDrawingSource(request, getLDrawModelIndex()) !== null,
    isDrawingReturned: false,
    isFailed: false,
  })

const getParticleCall = (id: number, request: ParticleDrawingRequest): HookCall =>
  Object.freeze({
    id,
    hook: HookKind.PARTICLE,
    key: request.materialName,
    wheelsKey: null,
    isModelPresent: getIsParticleMaterialDrawn(request.materialName),
    isDrawingReturned: false,
    isFailed: false,
  })

const getHasMesh = (object: Object3D): boolean =>
  object.getObjectByProperty('isMesh', true) !== undefined

// A drawing is settled once it has a mesh, or when it draws nothing by design (in place of a shield's inside).
const getIsSettled = (object: Object3D): boolean =>
  getHasMesh(object) || object.children.length === 0

const getIsDrawingFailed = (object: Object3D | undefined): boolean =>
  object?.userData[POWER_UP_DRAWING_FAILED_KEY] === true

// Wraps an extension so every call of its car, driver, effect model and particle hooks is recorded with its outcome, and the
// drawings it returns can be told apart in a rendered scene.
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
    getEffectModelDrawing: (request) => {
      const id = begin(getEffectModelCall(nextId, request))
      const drawing = extension.getEffectModelDrawing(request)
      if (drawing !== null) keep(id, drawing)
      return drawing
    },
    getParticleDrawing: (request) => {
      const id = begin(getParticleCall(nextId, request))
      const drawing = extension.getParticleDrawing(request)
      if (drawing !== null) keep(id, drawing.object)
      return drawing
    },
  }
  const recorder: CoverageRecorder = {
    reset: () => {
      calls = new Map()
      drawings = new Map()
    },
    getCalls: () =>
      [...calls.values()].map((call) =>
        getIsDrawingFailed(drawings.get(call.id)) ? { ...call, isFailed: true } : call
      ),
    getCallId: (object) => {
      const id: unknown = object.userData[CALL_ID_KEY]
      return typeof id === 'number' ? id : null
    },
    getUnsettledCallIds: () =>
      [...drawings].flatMap(([id, object]) =>
        calls.get(id)?.isFailed === true || getIsDrawingFailed(object) || getIsSettled(object)
          ? []
          : [id]
      ),
  }
  return { extension: recorded, recorder }
}
