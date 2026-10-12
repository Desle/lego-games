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

// A car built from bricks, in place of the mesh the original builds when a viewer extension has a drawing for it (the
// original's mesh is hidden and the drawing, in the mesh's own frame, is shown with it); the model itself otherwise.
export const showBuiltCarDrawing = (
  model: ModelObject,
  archive: JamArchive,
  design: CarDesign
): ModelObject => {
  const drawing = getBuiltCarDrawing({ archive, design })
  if (drawing === null) return model
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
