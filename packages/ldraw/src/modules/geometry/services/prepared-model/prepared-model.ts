import { Vector3 } from 'three'
import type { Group } from 'three'
import { getModelDetail } from '../../../library/index.ts'
import type { LDrawDetail } from '../../../library/index.ts'
import {
  applyPlasticLook,
  createOcclusionVolume,
  getActiveLook,
  getLookNeedsOcclusion,
  precompileShaders,
} from '../../../material/index.ts'
import type { OcclusionVolume } from '../../../material/index.ts'
import { markDetailEdges } from '../detail-switch/detail-switch.ts'
import { disposeSharedObject, markGeometryShared } from '../dispose-object/dispose-object.ts'
import { createHeldCache } from '../held-cache/held-cache.ts'
import {
  deserializeModel,
  getLibraryUrl,
  measureModelWork,
  requestParsedModel,
} from '../ldraw-parse/ldraw-parse-client.ts'
import type { SerializedModel } from '../ldraw-parse/ldraw-parse.types.ts'
import { PreparedModelKind } from './prepared-model.types.ts'
import type { PreparedModel, PreparedModelHold } from './prepared-model.types.ts'

// How many models nobody draws are kept for the next drawing (a car leaving the garage for the race) before the oldest is freed.
const IDLE_MODEL_LIMIT = 8

const freePreparedModel = ({ model, subModels }: PreparedModel) => {
  disposeSharedObject(model)
  for (const subModel of subModels) disposeSharedObject(subModel.unit)
}

const preparedModels = createHeldCache<PreparedModel>(freePreparedModel, IDLE_MODEL_LIMIT)

// A model a worker has built, as plastic of the active look, its edge lines marked so the shadow pass can leave them out.
const createPlasticModel = (
  model: SerializedModel,
  volume: OcclusionVolume | null,
  isWheel: boolean
): Group => {
  const group = deserializeModel(model)
  measureModelWork('look', () => applyPlasticLook(group, volume, isWheel))
  markDetailEdges(group)
  markGeometryShared(group)
  return group
}

const prepareModel = async (
  text: string,
  detail: LDrawDetail,
  kind: PreparedModelKind
): Promise<PreparedModel> => {
  const result = await requestParsedModel({
    text,
    detail,
    isOcclusionBaked: getLookNeedsOcclusion(getActiveLook()),
    libraryUrl: getLibraryUrl(),
    isSplittingSubModels: kind === PreparedModelKind.BODY,
  })
  const volume = result.grid === null ? null : createOcclusionVolume(result.grid)
  const model = createPlasticModel(result.body, volume, kind === PreparedModelKind.WHEEL)
  const subModels = result.subModels.map((subModel) => ({
    unit: createPlasticModel(subModel.model, volume, true),
    centre: new Vector3(...subModel.centre),
  }))
  await precompileShaders(model)
  return { model, subModels }
}

// The one way a model of the library is made drawable: parsed and merged in the worker, made the plastic of the active look and
// compiled, once for each look, detail, kind and text however many drawings show it. What it holds is shared: draw copies of it
// (`instantiateModel`), and release the hold when the drawing goes.
export const holdPreparedModel = (
  text: string,
  askedDetail: LDrawDetail,
  kind: PreparedModelKind = PreparedModelKind.PART
): PreparedModelHold => {
  const detail = getModelDetail(askedDetail)
  const key = `${getActiveLook().label}|${detail}|${kind}|${text}`
  const { value, release } = preparedModels.hold(key, () => prepareModel(text, detail, kind))
  return { prepared: value, release }
}
