import { Mesh } from 'three'
import type { Material, Object3D } from 'three'
import type { ModelObject } from '../model-object/model-object.types.ts'

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

export const disposeDrawing = (drawing: Object3D) => {
  const materials = new Set<Material>()
  drawing.traverse((child) => {
    if (!getIsMesh(child)) return
    child.geometry.dispose()
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material)
    }
  })
  for (const material of materials) material.dispose()
}

// A model with a drawing shown in its place: the model's own drawing is hidden and the drawing, in the model's frame, is shown.
export const showDrawingInPlaceOfModel = (model: ModelObject, drawing: Object3D): ModelObject => {
  const { group, object } = model
  object.group.visible = false
  group.add(drawing)
  return {
    group,
    object: {
      ...object,
      dispose: () => {
        object.dispose()
        disposeDrawing(drawing)
      },
    },
  }
}
