import { Group } from 'three'
import type {
  DriverDrawing,
  DriverDrawingPose,
  DriverDrawingRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createLDrawDriverDrawing } from '../ldraw-racer/ldraw-driver-drawing.ts'
import { RacerPartKind } from '../ldraw-racer/ldraw-racer-drawing.types.ts'
import { setDrawingOpacity } from './drawing-opacity.ts'

// A driver as a complete LDraw minifigure of the library's parts, posed by the game's skeleton: in the frame of the part the viewer
// positions (the model's scale applied). Null when the model has no skeleton to pose it on.
export const createLDrawRacerDriver = (
  request: DriverDrawingRequest,
  search: string
): DriverDrawing | null => {
  const figure = createLDrawDriverDrawing(
    {
      kind: RacerPartKind.DRIVER,
      archive: request.archive,
      model: request.driver.model,
      modelName: request.driver.modelName,
      partBytes: request.driver.partBytes,
    },
    search
  )
  if (figure === null) return null
  const object = new Group()
  object.matrixAutoUpdate = false
  const scaled = new Group()
  scaled.scale.setScalar(request.driver.model.meshScales[0] ?? 1)
  scaled.add(figure.object)
  object.add(scaled)
  const live = { opacity: 1 }
  // The parts arrive from the library after the first poses, so the opacity is applied again when they have.
  void figure.settled.then(() => setDrawingOpacity(object, live.opacity))
  return Object.freeze({
    object,
    applyPose: (pose: DriverDrawingPose) => {
      object.matrix.copy(pose.matrix)
      Object.assign(object, { visible: pose.isVisible, matrixWorldNeedsUpdate: true })
      if (pose.animationState !== null) figure.setAnimationState(pose.animationState)
      if (pose.opacity !== live.opacity) {
        live.opacity = pose.opacity
        setDrawingOpacity(object, live.opacity)
      }
    },
    animate: figure.animate,
    dispose: figure.dispose,
  })
}
