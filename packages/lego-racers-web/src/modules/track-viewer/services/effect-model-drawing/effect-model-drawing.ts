import { getEffectModelDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { showDrawingInPlaceOfModel } from '../built-car-drawing/built-car-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'

// An effect's model, in place of which a viewer extension may offer a drawing; the model itself otherwise.
export const showEffectModelDrawing = (
  model: ModelObject,
  request: EffectModelDrawingRequest
): ModelObject => {
  const drawing = getEffectModelDrawing(request)
  return drawing === null ? model : showDrawingInPlaceOfModel(model, drawing)
}
