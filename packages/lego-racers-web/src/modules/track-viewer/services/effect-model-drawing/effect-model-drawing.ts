import { getEffectModelDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { disposeDrawing } from '../built-car-drawing/built-car-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'

// An effect's model, in place of which a viewer extension may offer a drawing (the original's drawing is hidden and the
// extension's, in the model's frame, shown with it); the model itself otherwise.
export const showEffectModelDrawing = (
  model: ModelObject,
  request: EffectModelDrawingRequest
): ModelObject => {
  const drawing = getEffectModelDrawing(request)
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
