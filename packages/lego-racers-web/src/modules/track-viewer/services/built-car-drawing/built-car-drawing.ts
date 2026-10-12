import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { Mesh } from 'three'
import type { Material, Object3D } from 'three'
import { getBuiltCarDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
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

// A car built from bricks, in place of the mesh the original builds when a viewer extension has a drawing for it; the model itself
// otherwise.
export const showBuiltCarDrawing = (
  model: ModelObject,
  archive: JamArchive,
  design: CarDesign
): ModelObject => {
  const drawing = getBuiltCarDrawing({ archive, design })
  return drawing === null ? model : showDrawingInPlaceOfModel(model, drawing)
}
