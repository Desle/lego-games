import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  createMaterialSet,
  DetailSwitch,
  getIsMesh,
  holdPreparedModel,
  instantiateModel,
} from '@lego-games/ldraw/geometry'
import type { MaterialSet } from '@lego-games/ldraw/geometry'
import { getIsStudLogoShown, LDrawDetail } from '@lego-games/ldraw/library'
import { Box3, Group } from 'three'
import type { Material, Mesh, Object3D } from 'three'
import {
  ALPHA_OVERRIDE_KEY,
  BACK_FACES_VARIANT,
  POWER_UP_OBJECT_MODEL_NAMES,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getLDrawModelIndex, loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'
import { brightenPlastic, createLDrawPickupDrawing } from '../ldraw-pickup/ldraw-pickup-drawing.ts'
import { LDRAW_PICKUP_MAPPINGS } from '../ldraw-pickup/ldraw-pickup-mappings.ts'
import { getOriginalModelBounds, getPowerUpObjectMatrix } from './powerup-object-frame.ts'
import { EffectModelDrawingSourceKind } from './powerup-object-drawing.types.ts'
import type {
  EffectModelDrawingSource,
  PreparedPowerUpObject,
} from './powerup-object-drawing.types.ts'

const ALPHA_MAXIMUM = 255
// Set on a drawing whose file could not be read or prepared, for the coverage trace.
export const POWER_UP_DRAWING_FAILED_KEY = 'isPowerUpDrawingFailed'

const preparations = new Map<string, Promise<PreparedPowerUpObject | null>>()
const prepared = new Map<string, PreparedPowerUpObject | null>()

const preparePowerUpObject = async (file: string): Promise<PreparedPowerUpObject | null> => {
  try {
    const text = await loadLDrawModelText(file)
    if (text === null) return null
    const { model } = await holdPreparedModel(text, LDrawDetail.LOW).prepared
    model.updateMatrixWorld(true)
    return Object.freeze({ text, model, bounds: new Box3().setFromObject(model) })
  } catch (error: unknown) {
    console.error(`The power-up object ${file} could not be prepared`, error)
    return null
  }
}

// The file read and prepared once for the page's life (it is held: a race draws dozens of copies).
const loadPreparedPowerUpObject = (file: string): Promise<PreparedPowerUpObject | null> => {
  const known = preparations.get(file)
  if (known !== undefined) return known
  const preparation = preparePowerUpObject(file).then((result) => {
    prepared.set(file, result)
    return result
  })
  preparations.set(file, preparation)
  return preparation
}

// Reads and prepares every power-up object of the models folder before the race asks for one, so a projectile fired mid-race is
// drawn from its first frame.
export const preparePowerUpObjects = (index: LDrawModelIndex): Promise<void> =>
  Promise.all(Object.values(index.powerUps).map(loadPreparedPowerUpObject)).then(() => undefined)

// Where the layer's drawing of an effect's model comes from: a power-up object's file (nothing for the inside of a model a file
// draws whole), else the part of a pickup brick; null when the layer has nothing and the original is drawn.
export const getEffectModelDrawingSource = (
  request: Pick<EffectModelDrawingRequest, 'modelName' | 'variant'>,
  index: LDrawModelIndex
): EffectModelDrawingSource | null => {
  const file = POWER_UP_OBJECT_MODEL_NAMES.includes(request.modelName)
    ? index.powerUps[request.modelName]
    : undefined
  if (file !== undefined) {
    return request.variant === BACK_FACES_VARIANT
      ? { kind: EffectModelDrawingSourceKind.NOTHING, file: null }
      : { kind: EffectModelDrawingSourceKind.FILE, file }
  }
  return LDRAW_PICKUP_MAPPINGS[request.modelName] === undefined
    ? null
    : { kind: EffectModelDrawingSourceKind.PICKUP_PART, file: null }
}

const getMaterials = (mesh: Mesh): readonly Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material]

// The race fades an effect with the device's alpha override, which each mesh of the model notes; the drawing's own materials
// take it as their opacity just before they are drawn.
const followAlphaOverride = (level: Object3D) =>
  level.traverse((child) => {
    if (!getIsMesh(child)) return
    Object.assign(child, {
      onBeforeRender: () => {
        const alpha: unknown = child.userData[ALPHA_OVERRIDE_KEY]
        const opacity = typeof alpha === 'number' ? alpha / ALPHA_MAXIMUM : 1
        for (const material of getMaterials(child)) material.opacity = opacity
      },
    })
  })

const createLevel = (model: Group, materials: MaterialSet): Group => {
  const level = instantiateModel(model, materials)
  brightenPlastic(level)
  followAlphaOverride(level)
  return level
}

const createDetailSwitch = (object: PreparedPowerUpObject): DetailSwitch => {
  const materials = createMaterialSet()
  const detailSwitch = new DetailSwitch()
  detailSwitch.setLow(createLevel(object.model, materials))
  if (getIsStudLogoShown()) {
    detailSwitch.setHighLoader(async () => {
      const { model } = await holdPreparedModel(object.text, LDrawDetail.HIGH).prepared
      return createLevel(model, materials)
    })
  }
  return detailSwitch
}

const fillDrawing = (holder: Group, object: PreparedPowerUpObject, model: ModelScene) => {
  holder.matrix.copy(getPowerUpObjectMatrix(getOriginalModelBounds(model), object.bounds))
  holder.add(createDetailSwitch(object))
  Object.assign(holder, { matrixWorldNeedsUpdate: true })
}

// A power-up object's file in place of the original's model, in the model's frame (powerup-object-frame.ts). Prepared files are
// drawn at once; a file still being prepared appears when it is, one that failed leaves the original (null).
export const createPowerUpObjectDrawing = (file: string, model: ModelScene): Group | null => {
  const object = prepared.get(file)
  if (object === null) return null
  const drawing = new Group()
  const holder = new Group()
  holder.matrixAutoUpdate = false
  drawing.add(holder)
  if (object !== undefined) {
    fillDrawing(holder, object, model)
    return drawing
  }
  void loadPreparedPowerUpObject(file).then((loaded) => {
    if (loaded === null) drawing.userData[POWER_UP_DRAWING_FAILED_KEY] = true
    else fillDrawing(holder, loaded, model)
  })
  return drawing
}

// The layer's drawing in place of an effect's model, or null to keep the original's.
export const createLDrawEffectModelDrawing = (
  request: EffectModelDrawingRequest
): Object3D | null => {
  const source = getEffectModelDrawingSource(request, getLDrawModelIndex())
  if (source === null) return null
  if (source.kind === EffectModelDrawingSourceKind.NOTHING) return new Group()
  if (source.kind === EffectModelDrawingSourceKind.PICKUP_PART)
    return createLDrawPickupDrawing(request.modelName, request.variant)
  return createPowerUpObjectDrawing(source.file ?? '', request.model)
}
