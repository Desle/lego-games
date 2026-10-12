import { Material, Mesh } from 'three'
import type { Group } from 'three'
import { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import { measureWork } from '../performance-monitor/performance-monitor.ts'
import { deserializeModel, requestParsedModel } from '../ldraw-worker/ldraw-parse-client.ts'
import type { SerializedModel } from '../ldraw-worker/ldraw-parse.types.ts'
import { precompileShaders } from './shader-precompiler.ts'
import { DetailSwitch, markDetailEdges } from './detail-switch.ts'
import { getActiveLook } from './ldraw-look.ts'
import { getLookNeedsShader } from './ldraw-look-shader.ts'
import { createOcclusionVolume } from './ldraw-occlusion.ts'
import type { OcclusionVolume } from './ldraw-occlusion.types.ts'
import { applyPlasticLook } from './ldraw-plastic.ts'
import type { DetailedPart, MaterialSet } from './detailed-model.types.ts'

const getIsMaterial = (value: unknown): value is Material => value instanceof Material

const preparedModels = new Map<string, Promise<Group>>()

// Whether the active look wants the occlusion grid baked with the model.
export const getIsOcclusionBaked = (): boolean => getLookNeedsShader(getActiveLook())

// A model a worker has built as plastic of the active look, its edge lines marked so the shadow pass can leave them out.
export const createPlasticModel = (
  model: SerializedModel,
  volume: OcclusionVolume | null
): Group => {
  const group = deserializeModel(model)
  measureWork('look', () => applyPlasticLook(group, volume))
  markDetailEdges(group)
  return group
}

// A model of the library as the plastic of the active look, merged into a few objects, made once for each text and detail however
// many cars, drivers and races use it (a part is parsed, baked and uploaded once). What it holds is shared: take a copy with
// `instantiateModel`.
export const getPreparedModel = (text: string, detail: LDrawDetail): Promise<Group> => {
  const key = `${detail}|${text}`
  const existing = preparedModels.get(key)
  if (existing !== undefined) return existing
  const prepared = requestParsedModel({
    text,
    detail,
    isOcclusionBaked: getIsOcclusionBaked(),
    isTakingWheels: false,
  }).then(async (result) => {
    const model = createPlasticModel(
      result.body,
      result.grid === null ? null : createOcclusionVolume(result.grid)
    )
    await precompileShaders(model)
    return model
  })
  preparedModels.set(key, prepared)
  prepared.catch(() => preparedModels.delete(key))
  return prepared
}

// The plastic materials of one drawing: a copy of each, made when first asked for, so the drawing can fade (a ghost) without
// touching the others that draw the same parts.
export const createMaterialSet = (): MaterialSet => {
  const copies = new Map<Material, Material>()
  return {
    getCopy: (source) => {
      const existing = copies.get(source)
      if (existing !== undefined) return existing
      const copy = source.clone()
      Object.assign(copy, {
        onBeforeCompile: Reflect.get(source, 'onBeforeCompile'),
        customProgramCacheKey: Reflect.get(source, 'customProgramCacheKey'),
      })
      copies.set(source, copy)
      return copy
    },
    dispose: () => {
      for (const copy of copies.values()) copy.dispose()
      copies.clear()
    },
  }
}

// A copy of a prepared model that shares its geometry and the lines' materials, with the drawing's own copies of the meshes' materials.
export const instantiateModel = (prepared: Group, materials: MaterialSet): Group => {
  const copy = prepared.clone()
  copy.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const material: unknown = child.material
    if (getIsMaterial(material)) Object.assign(child, { material: materials.getCopy(material) })
    else if (Array.isArray(material)) {
      Object.assign(child, { material: material.filter(getIsMaterial).map(materials.getCopy) })
    }
  })
  return copy
}

// A part drawn in two details (the plain-stud model first, the logo-stud model built when the camera comes near), shared with every
// other drawing of the same text. `onInstance` touches each copy of a level (a pickup's glow) before it is shown.
export const createDetailedPart = (
  text: string,
  materials: MaterialSet,
  onInstance: ((copy: Group) => void) | null
): DetailedPart => {
  const object = new DetailSwitch()
  const instantiate = (prepared: Group): Group => {
    const copy = instantiateModel(prepared, materials)
    onInstance?.(copy)
    return copy
  }
  object.setHighLoader(() => getPreparedModel(text, LDrawDetail.HIGH).then(instantiate))
  const shown = getPreparedModel(text, LDrawDetail.LOW).then((prepared) =>
    object.setLow(instantiate(prepared))
  )
  return { object, shown }
}
