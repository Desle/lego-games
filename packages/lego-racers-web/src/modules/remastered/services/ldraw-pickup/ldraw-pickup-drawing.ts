import { Group, Matrix4, Mesh, MeshPhysicalMaterial } from 'three'
import type { Object3D } from 'three'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createDetailedPart, createMaterialSet } from '@lego-games/ldraw/geometry'
import { LDRAW_PICKUP_MAPPINGS } from './ldraw-pickup-mappings.ts'
import type { LDrawPickupMapping } from './ldraw-pickup-mappings.types.ts'

// With no lights of its own the plastic is lit by its studio reflections alone; a share of its colour glows to stand in for the ambient light.
const PICKUP_ENVIRONMENT_INTENSITY = 1.6
const PICKUP_GLOW = 0.22

// Every pickup of the page shares its plastic (none of them fades): a track holds dozens.
const pickupMaterials = createMaterialSet()

const getPhysicalMaterials = (model: Object3D): MeshPhysicalMaterial[] => {
  const materials: MeshPhysicalMaterial[] = []
  model.traverse((child) => {
    if (child instanceof Mesh && child.material instanceof MeshPhysicalMaterial)
      materials.push(child.material)
  })
  return materials
}

const brightenPlastic = (model: Object3D) => {
  for (const material of getPhysicalMaterials(model)) {
    material.envMapIntensity = PICKUP_ENVIRONMENT_INTENSITY
    material.emissive.copy(material.color).multiplyScalar(PICKUP_GLOW)
  }
}

export const getPickupColorCode = (
  mapping: LDrawPickupMapping,
  request: EffectModelDrawingRequest
): number => mapping.colorCodes[request.variant ?? ''] ?? mapping.defaultColorCode

export const getPickupMatrix = (mapping: LDrawPickupMapping): Matrix4 => {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33, x, y, z] = mapping.matrix
  return new Matrix4().set(m11, m12, m13, x, m21, m22, m23, y, m31, m32, m33, z, 0, 0, 0, 1)
}

// The LDraw part in place of an effect's model, in the model's frame, or null when no part stands in for the model. The part is
// lit by the studio in its plastic alone (no lights of its own: a track holds dozens of them); it appears once the library has
// delivered it, and until then only the track is seen.
export const createLDrawPickupDrawing = (request: EffectModelDrawingRequest): Group | null => {
  const mapping = LDRAW_PICKUP_MAPPINGS[request.modelName]
  if (mapping === undefined) return null
  const holder = new Group()
  holder.matrixAutoUpdate = false
  holder.matrix.copy(getPickupMatrix(mapping))
  const drawing = new Group()
  drawing.add(holder)
  const line = `1 ${String(getPickupColorCode(mapping, request))} 0 0 0 1 0 0 0 1 0 0 0 1 ${mapping.partNumber}.dat`
  const part = createDetailedPart(line, pickupMaterials, brightenPlastic)
  holder.add(part.object)
  part.shown.catch((error: unknown) =>
    console.error('The LDraw library could not build the brick', error)
  )
  return drawing
}
