import type { BuilderPreview } from '@lego-games/lego-racers/front-end'
import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltCarScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene as ThreeScene } from 'three'
import { getCarDesignKey } from '../car-design-key/car-design-key.ts'
import { getDesignChassisName, loadChassisWheels } from '../racer-drawing/chassis-wheels.ts'
import { showCarDrawing } from '../racer-drawing/racer-drawing.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { BuilderCarView } from './builder-car-view.types.ts'

// The model alone when the drawing's wheels cannot be read: the builder never goes blank over a drawing.
const showGuardedCarDrawing = (
  archive: JamArchive,
  model: ModelObject,
  design: CarDesign,
  chassisName: string
): ModelObject => {
  try {
    return showCarDrawing(model, {
      archive,
      carCode: null,
      design,
      wheels: loadChassisWheels(archive, chassisName),
    })
  } catch (error: unknown) {
    console.warn(
      `The car drawing for ${chassisName} could not be made; the original car is drawn`,
      error
    )
    return model
  }
}

// The car of the builder screen in the garage world: the mesh builder's model of the placed bricks and the brick in the
// cursor (FrontEnd_BuildBuiltCarSlot 0x0042dcb0 builds the race car the same way), replaced when the design changes.
export const createBuilderCarView = (archive: JamArchive, scene: ThreeScene): BuilderCarView => {
  const slot = createModelSlot(scene)
  return Object.freeze({
    show: (preview: BuilderPreview) =>
      slot.show(getCarDesignKey(preview.design), () => {
        const { design } = preview
        const chassisName = getDesignChassisName(design)
        const model = createModelObject(loadBuiltCarScene(archive, design))
        return chassisName === null
          ? model
          : showGuardedCarDrawing(archive, model, design, chassisName)
      }),
    dispose: slot.dispose,
  })
}
