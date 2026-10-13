import type { Group, Material } from 'three'
import { getIsStudLogoShown, LDrawDetail } from '../../../library/index.ts'
import { DetailSwitch } from '../detail-switch/detail-switch.ts'
import { getIsMaterial, getIsMesh } from '../object-guards/object-guards.ts'
import { holdPreparedModel } from '../prepared-model/prepared-model.ts'
import { PreparedModelKind } from '../prepared-model/prepared-model.types.ts'
import type { PreparedModel } from '../prepared-model/prepared-model.types.ts'
import type { SplitSubModel } from '../ldraw-parse/ldraw-parse.types.ts'
import type { DetailedModel, DetailedModelSettings, MaterialSet } from './detailed-model.types.ts'

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
    if (!getIsMesh(child)) return
    const material: unknown = child.material
    if (getIsMaterial(material)) Object.assign(child, { material: materials.getCopy(material) })
    else if (Array.isArray(material)) {
      Object.assign(child, { material: material.filter(getIsMaterial).map(materials.getCopy) })
    }
  })
  return copy
}

const instantiateSubModels = (
  subModels: readonly SplitSubModel[],
  materials: MaterialSet
): readonly SplitSubModel[] =>
  subModels.map(({ unit, centre }) => ({
    unit: instantiateModel(unit, materials),
    centre: centre.clone(),
  }))

// A model drawn in two details (the plain-stud model first, the logo-stud model built when the camera comes near, one shown by the
// distance), each a copy of the prepared model every other drawing of the text shares. `onInstance` touches each copy of a level (a
// pickup's glow) before it is shown; with `onSubModels` the app's splitter takes sub-models (a car's wheels) out of the model, and
// it is told of their copies (in the model's frame, as wheel plastic) for each detail. Release the drawing when it goes.
export const createDetailedModel = (
  text: string,
  { materials, onInstance, onSubModels }: DetailedModelSettings
): DetailedModel => {
  const object = new DetailSwitch()
  const kind = onSubModels === null ? PreparedModelKind.PART : PreparedModelKind.BODY
  const releases: (() => void)[] = []
  let isReleased = false
  const loadLevel = async (detail: LDrawDetail): Promise<Group> => {
    if (isReleased) throw new Error('The LDraw model was released before its level was built')
    const hold = holdPreparedModel(text, detail, kind)
    releases.push(hold.release)
    const { model, subModels }: PreparedModel = await hold.prepared
    const copy = instantiateModel(model, materials)
    onInstance?.(copy)
    onSubModels?.(instantiateSubModels(subModels, materials), detail)
    return copy
  }
  if (getIsStudLogoShown()) object.setHighLoader(() => loadLevel(LDrawDetail.HIGH))
  const shown = loadLevel(LDrawDetail.LOW).then((low) => object.setLow(low))
  return {
    object,
    shown,
    refined: () => shown.then(() => object.requestHigh()),
    release: () => {
      isReleased = true
      for (const release of releases.splice(0)) release()
    },
  }
}
